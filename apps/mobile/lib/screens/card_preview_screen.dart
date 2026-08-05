import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

class CardPreviewScreen extends StatelessWidget {
  final String profileId;
  const CardPreviewScreen({super.key, required this.profileId});

  @override
  Widget build(BuildContext context) {
    final profileUrl = 'https://tap.mdmcreation.com/profile/$profileId';

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
            FilledButton.icon(
              onPressed: () => context.push('/nfc/write/$profileId'),
              icon: const Icon(Icons.nfc),
              label: const Text('Write NFC Card'),
            ),
          ],
        ),
      ),
    );
  }
}
