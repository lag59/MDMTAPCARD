import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import '../services/nfc_service.dart';

enum WriteStep { idle, preparing, scanning, verifying, done, failed }

class WriteNfcScreen extends ConsumerStatefulWidget {
  final String profileId;
  const WriteNfcScreen({super.key, required this.profileId});

  @override
  ConsumerState<WriteNfcScreen> createState() => _WriteNfcScreenState();
}

class _WriteNfcScreenState extends ConsumerState<WriteNfcScreen> {
  WriteStep _step = WriteStep.idle;
  String? _tagId;
  String? _profileUrl;
  String? _profileName;
  String? _statusLabel;
  String _hardwareType = 'card';
  String? _maskedUid;
  String? _tagType;
  int? _capacityBytes;
  String? _errorMessage;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadNfcStatus();
  }

  Future<void> _loadNfcStatus() async {
    try {
      final status = await ApiClient.getProfileNfcStatus(widget.profileId);
      if (!mounted) return;
      setState(() {
        _statusLabel = status['status']?.toString();
        _hardwareType = status['hardware_type']?.toString() ?? 'card';
        _maskedUid = status['masked_tag_uid']?.toString();
        _tagType = status['tag_type']?.toString();
        _capacityBytes = status['capacity_bytes'] is int ? status['capacity_bytes'] as int : null;
        _profileUrl = status['profile_url']?.toString() ?? _profileUrl;
      });
    } catch (_) {
      // non-blocking
    }
  }

  Future<void> _startWrite() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _errorMessage = null;
    });

    final canProgram = await ApiClient.canProgramNfc();
    if (!canProgram) {
      if (!mounted) return;
      setState(() {
        _step = WriteStep.failed;
        _errorMessage = 'Access denied. NFC programming is restricted to MDM TapCard administrators.';
        _busy = false;
      });
      return;
    }

    final available = await NfcService.isAvailable();
    if (!available) {
      if (!mounted) return;
      setState(() {
        _step = WriteStep.failed;
        _errorMessage = 'NFC is not available or not enabled on this device.';
        _busy = false;
      });
      return;
    }

    if (!mounted) return;
    setState(() => _step = WriteStep.preparing);

    try {
      // 1. Reserve a tag record in the API and get the URL to write
      final prepared = await ApiClient.prepareTag(widget.profileId);
      if (!mounted) return;
      _tagId = prepared['tag_id'] as String;
      _profileUrl = prepared['profile_url'] as String;
      _profileName = prepared['profile_name']?.toString();
      _hardwareType = prepared['hardware_type']?.toString() ?? _hardwareType;

      setState(() => _step = WriteStep.scanning);

      // 2. Write the URL to the physical tag
      final result = await NfcService.writeUrl(_profileUrl!);
      if (!mounted) return;

      if (!result.success) {
        setState(() {
          _step = WriteStep.failed;
          _errorMessage = result.errorMessage ?? 'NFC programming failed.';
          _busy = false;
        });
        return;
      }

      setState(() => _step = WriteStep.verifying);

      // 3. Confirm the write with the API (logs tag UID, type, capacity)
      final confirmation = await ApiClient.confirmWrite(
        tagId: _tagId!,
        verifiedUrl: result.verifiedUrl ?? _profileUrl!,
        tagUid: result.tagUid,
        tagType: result.tagType,
        capacityBytes: result.capacityBytes,
      );

      if (!mounted) return;
      setState(() {
        _step = confirmation['success'] == true ? WriteStep.done : WriteStep.failed;
        _errorMessage = confirmation['success'] == true ? null : 'Server verification failed';
        _busy = false;
        _maskedUid = _maskUid(result.tagUid);
        _tagType = result.tagType;
        _capacityBytes = result.capacityBytes;
        _statusLabel = confirmation['status']?.toString() ?? 'verified';
      });
      await _loadNfcStatus();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _step = WriteStep.failed;
        _errorMessage = 'Could not complete NFC programming. Please try again.';
        _busy = false;
      });
    }
  }

  String? _maskUid(String? uid) {
    if (uid == null || uid.isEmpty) return null;
    final compact = uid.replaceAll(':', '');
    if (compact.length < 7) return '***';
    return '${compact.substring(0, 4)}***${compact.substring(compact.length - 2)}';
  }

  void _resetForNextCard() {
    setState(() {
      _step = WriteStep.idle;
      _tagId = null;
      _profileUrl = null;
      _profileName = null;
      _maskedUid = null;
      _tagType = null;
      _capacityBytes = null;
      _statusLabel = null;
      _errorMessage = null;
      _busy = false;
    });
  }

  Future<void> _testCard() async {
    final value = await NfcService.readUrl();
    if (!mounted) return;
    if (value == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No readable URL was found on this NFC card.')),
      );
      return;
    }
    final matches = _profileUrl != null && value.trim() == _profileUrl!.trim();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(matches ? 'Card test passed.' : 'Card test read a different URL.')),
    );
  }

  Future<void> _disableTag() async {
    if (_tagId == null) return;
    await ApiClient.disableTag(_tagId!, reason: 'Disabled from admin app');
    await _loadNfcStatus();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Tag disabled.')), 
    );
  }

  Future<void> _replaceTag() async {
    if (_tagId == null) return;
    await ApiClient.replaceTag(_tagId!, reason: 'Replacement requested from admin app');
    await _loadNfcStatus();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Tag marked as replaced. Program a new card.')),
    );
  }

  Future<void> _confirmLock() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Mark Card as Finalized?'),
        content: const Text(
          'This only finalizes the database status and does not physically lock the NFC hardware.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Finalize'),
          ),
        ],
      ),
    );
    if (confirmed == true && _tagId != null) {
      await ApiClient.finalizeTag(_tagId!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Card marked as finalized in the database.')),
        );
      }
    }
  }

  String _headlineByStep() {
    final productName = _hardwareType == 'button' ? 'NFC TapButton' : 'NFC TapCard';
    switch (_step) {
      case WriteStep.idle:
        return 'Program $productName';
      case WriteStep.preparing:
        return 'Preparing Card';
      case WriteStep.scanning:
        return 'Program $productName';
      case WriteStep.verifying:
        return 'Verifying NFC Card';
      case WriteStep.done:
        return 'Card Programmed and Verified';
      case WriteStep.failed:
        return 'Programming Failed';
    }
  }

  String _subtextByStep() {
    final scanItem = _hardwareType == 'button' ? 'NFC TapButton' : 'NFC business card';
    switch (_step) {
      case WriteStep.idle:
        return 'Tap the button below when you are ready to program a blank NFC card.';
      case WriteStep.preparing:
        return 'Creating a secure permanent public URL for this customer card.';
      case WriteStep.scanning:
        return 'Hold the $scanItem near the NFC antenna area of your phone. Keep the card still until programming finishes.';
      case WriteStep.verifying:
        return 'Reading the card back and confirming it matches exactly.';
      case WriteStep.done:
        return 'Programming and verification completed successfully.';
      case WriteStep.failed:
        return 'Please review the error and retry.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final productName = _hardwareType == 'button' ? 'NFC TapButton' : 'NFC TapCard';
    return Scaffold(
      appBar: AppBar(title: Text('Program $productName')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _StepIndicator(step: _step),
            const SizedBox(height: 32),
            Text(_headlineByStep(), style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(_subtextByStep(), style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 16),
            if (_statusLabel != null)
              Text('Status: $_statusLabel', style: Theme.of(context).textTheme.labelLarge),
            if (_hardwareType == 'button')
              const Padding(
                padding: EdgeInsets.only(top: 8, bottom: 8),
                child: Text(
                  'Place the NFC TapButton where it does not interfere with your phone\'s NFC antenna, wireless charging, MagSafe accessories, or other NFC tags.',
                  style: TextStyle(color: Colors.orange),
                ),
              ),
            if (_profileUrl != null) ...[
              Text('Public URL:', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 4),
              SelectableText(
                _profileUrl!,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
              ),
              const SizedBox(height: 16),
            ],
            if (_step == WriteStep.idle || _step == WriteStep.failed) ...[
              if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_errorMessage!, style: TextStyle(color: Colors.red.shade800)),
                ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _busy ? null : _startWrite,
                icon: const Icon(Icons.nfc),
                label: Text(_step == WriteStep.failed ? 'Retry' : 'Begin Programming'),
              ),
            ],
            if (_step == WriteStep.scanning)
              const Center(
                child: Column(children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Hold the NFC card near the NFC antenna area of your phone.'),
                ]),
              ),
            if (_step == WriteStep.done) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.check_circle, color: Colors.green, size: 48),
                    const SizedBox(height: 8),
                    const Text('✓ NFC CARD PROGRAMMED\n✓ VERIFIED',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    Text('Product: $productName', style: const TextStyle(fontSize: 12)),
                    if (_profileName != null)
                      Text('Customer: $_profileName', style: const TextStyle(fontSize: 12)),
                    if (_maskedUid != null)
                      Text('UID: $_maskedUid', style: const TextStyle(fontSize: 12)),
                    if (_tagType != null)
                      Text('Tag Type: $_tagType', style: const TextStyle(fontSize: 12)),
                    if (_capacityBytes != null)
                      Text('Capacity: $_capacityBytes bytes', style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: _testCard,
                    icon: const Icon(Icons.verified_outlined),
                    label: Text(_hardwareType == 'button' ? 'Test TapButton' : 'Test Card'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _replaceTag,
                    icon: const Icon(Icons.autorenew),
                    label: Text(_hardwareType == 'button' ? 'Replace TapButton' : 'Replace Card'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _disableTag,
                    icon: const Icon(Icons.block),
                    label: Text(_hardwareType == 'button' ? 'Disable TapButton' : 'Disable Tag'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _confirmLock,
                    icon: const Icon(Icons.lock_outline),
                    label: const Text('Mark Card as Finalized'),
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _resetForNextCard,
                icon: const Icon(Icons.add),
                label: Text(_hardwareType == 'button' ? 'Program Another TapButton' : 'Program Another Card'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final WriteStep step;
  const _StepIndicator({required this.step});

  @override
  Widget build(BuildContext context) {
    final steps = ['Prepare', 'Scan', 'Verify', 'Done'];
    final current = step.index.clamp(0, 3);
    return Row(
      children: List.generate(steps.length, (i) {
        final active = i <= current - 1 || step == WriteStep.done;
        return Expanded(
          child: Row(children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: active ? Colors.blue : Colors.grey.shade300,
              child: Text('${i + 1}',
                  style: TextStyle(
                      fontSize: 12, color: active ? Colors.white : Colors.grey.shade600)),
            ),
            if (i < steps.length - 1)
              Expanded(child: Divider(color: active ? Colors.blue : Colors.grey.shade300)),
          ]),
        );
      }),
    );
  }
}
