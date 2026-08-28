import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../services/api_client.dart';

class CardPreviewScreen extends StatefulWidget {
  final String profileId;
  const CardPreviewScreen({super.key, required this.profileId});

  @override
  State<CardPreviewScreen> createState() => _CardPreviewScreenState();
}

class _CardPreviewScreenState extends State<CardPreviewScreen> {
  bool _canProgram = false;
  bool _loadingStatus = true;
  Map<String, dynamic>? _status;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final canProgram = await ApiClient.canProgramNfc();
    Map<String, dynamic>? status;
    if (canProgram) {
      try {
        status = await ApiClient.getProfileNfcStatus(widget.profileId);
      } catch (_) {
        status = null;
      }
    }
    if (!mounted) return;
    setState(() {
      _canProgram = canProgram;
      _status = status;
      _loadingStatus = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final profileId = widget.profileId;
    final profileUrl = _status?['profile_url']?.toString() ?? 'https://mdmsolutionlab.com/t/$profileId';
    final statusLabel = _status?['status']?.toString() ?? 'not_programmed';
    final verified = _status?['is_verified'] == true;
    final cardType = _status?['card_type']?.toString() ?? 'digital_only';
    final requiresNfc = cardType == 'nfc_card' || cardType == 'nfc_button';
    final productLabel = switch (cardType) {
      'nfc_button' => 'NFC TAPBUTTON',
      'nfc_card' => 'NFC TAPCARD',
      _ => 'DIGITAL ONLY',
    };
    final maskedUid = _status?['masked_tag_uid']?.toString();
    final tagType = _status?['tag_type']?.toString();
    final programmedAt = _status?['programmed_at']?.toString();
    final tagId = _status?['tag_id']?.toString();

    return Scaffold(
      appBar: AppBar(title: const Text('Card Preview')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    CircleAvatar(radius: 34, child: Icon(Icons.person, size: 34, color: Colors.blue.shade700)),
                    const SizedBox(height: 12),
                    const Text('Preview Name', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    const Text('Job Title · Company', style: TextStyle(color: Colors.grey)),
                    const SizedBox(height: 16),
                    QrImageView(data: profileUrl, size: 130),
                    const SizedBox(height: 10),
                    SelectableText(profileUrl, style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerLeft,
              child: Chip(label: Text(productLabel)),
            ),
            const SizedBox(height: 10),
            if (requiresNfc)
              FilledButton.icon(
                onPressed: _canProgram ? () => context.push('/cards/$profileId/program-nfc') : null,
                icon: const Icon(Icons.nfc),
                label: Text(cardType == 'nfc_button' ? 'Program NFC TapButton' : 'Program NFC TapCard'),
              ),
            const SizedBox(height: 16),
            if (_canProgram && requiresNfc)
              Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: _loadingStatus
                      ? const Text('Loading NFC status...')
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('NFC Card', style: TextStyle(fontWeight: FontWeight.bold)),
                            const SizedBox(height: 8),
                            Text('Status: ${statusLabel == 'not_programmed' ? 'Not Programmed' : statusLabel}'),
                            Text('Verification: ${verified ? 'Verified' : 'Not Verified'}'),
                            if (maskedUid != null) Text('UID: $maskedUid'),
                            if (tagType != null) Text('Tag Type: $tagType'),
                            if (programmedAt != null) Text('Programmed At: $programmedAt'),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                OutlinedButton(
                                  onPressed: () => context.push('/cards/$profileId/program-nfc'),
                                  child: const Text('Program NFC Card'),
                                ),
                                OutlinedButton(
                                  onPressed: () => context.push('/nfc/verify/${tagId ?? 'unknown'}'),
                                  child: const Text('Test Card'),
                                ),
                                OutlinedButton(
                                  onPressed: tagId == null
                                      ? null
                                      : () async {
                                          await ApiClient.replaceTag(tagId, reason: 'Replace from card admin');
                                          await _init();
                                        },
                                  child: const Text('Replace Card'),
                                ),
                                OutlinedButton(
                                  onPressed: tagId == null
                                      ? null
                                      : () async {
                                          await ApiClient.disableTag(tagId, reason: 'Disable from card admin');
                                          await _init();
                                        },
                                  child: const Text('Disable Tag'),
                                ),
                              ],
                            ),
                          ],
                        ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
