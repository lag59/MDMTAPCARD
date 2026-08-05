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
  String? _errorMessage;
  NfcWriteResult? _writeResult;

  Future<void> _startWrite() async {
    final available = await NfcService.isAvailable();
    if (!available) {
      setState(() {
        _step = WriteStep.failed;
        _errorMessage = 'NFC is not available or not enabled on this device.';
      });
      return;
    }

    setState(() => _step = WriteStep.preparing);

    try {
      // 1. Reserve a tag record in the API and get the URL to write
      final prepared = await ApiClient.prepareTag(widget.profileId);
      _tagId = prepared['tag_id'] as String;
      _profileUrl = prepared['profile_url'] as String;

      setState(() => _step = WriteStep.scanning);

      // 2. Write the URL to the physical tag
      final result = await NfcService.writeUrl(_profileUrl!);
      _writeResult = result;

      if (!result.success) {
        setState(() {
          _step = WriteStep.failed;
          _errorMessage = result.errorMessage;
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

      setState(() {
        _step = confirmation['success'] == true ? WriteStep.done : WriteStep.failed;
        _errorMessage = confirmation['success'] == true ? null : 'Server verification failed';
      });
    } catch (e) {
      setState(() {
        _step = WriteStep.failed;
        _errorMessage = e.toString();
      });
    }
  }

  Future<void> _confirmLock() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Lock Tag Permanently?'),
        content: const Text(
          'This will make the tag read-only and CANNOT be undone. '
          'The URL on the card will never be changeable again. '
          'Are you sure you want to lock this tag?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Lock Permanently'),
          ),
        ],
      ),
    );
    if (confirmed == true && _tagId != null) {
      await ApiClient.lockTag(_tagId!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tag locked in database. Apply physical lock on device.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Write NFC Card')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _StepIndicator(step: _step),
            const SizedBox(height: 32),
            if (_profileUrl != null) ...[
              Text('URL to write:', style: Theme.of(context).textTheme.labelLarge),
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
                onPressed: _startWrite,
                icon: const Icon(Icons.nfc),
                label: Text(_step == WriteStep.failed ? 'Retry Write' : 'Write NFC Card'),
              ),
            ],
            if (_step == WriteStep.scanning)
              const Center(
                child: Column(children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Hold the NFC card near the top of your phone…'),
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
                    const Text('Card written and verified successfully!',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    if (_writeResult?.tagUid != null)
                      Text('UID: ${_writeResult!.tagUid}', style: const TextStyle(fontSize: 12)),
                    if (_writeResult?.tagType != null)
                      Text('Type: ${_writeResult!.tagType}', style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: _confirmLock,
                icon: const Icon(Icons.lock_outline),
                label: const Text('Lock Tag (optional)'),
                style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
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
