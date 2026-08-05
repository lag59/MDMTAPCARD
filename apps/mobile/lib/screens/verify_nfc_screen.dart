import 'package:flutter/material.dart';
import '../services/nfc_service.dart';

class VerifyNfcScreen extends StatefulWidget {
  final String tagId;
  const VerifyNfcScreen({super.key, required this.tagId});

  @override
  State<VerifyNfcScreen> createState() => _VerifyNfcScreenState();
}

class _VerifyNfcScreenState extends State<VerifyNfcScreen> {
  bool _loading = false;
  String? _url;
  String? _error;

  Future<void> _scan() async {
    setState(() {
      _loading = true;
      _error = null;
      _url = null;
    });
    try {
      final available = await NfcService.isAvailable();
      if (!available) throw Exception('NFC is unavailable');
      final url = await NfcService.readUrl();
      setState(() => _url = url ?? '(No URL found)');
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Read & Verify Card')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Tag Record: ${widget.tagId}', style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _loading ? null : _scan,
              icon: const Icon(Icons.nfc),
              label: Text(_loading ? 'Scanning...' : 'Scan Tag'),
            ),
            const SizedBox(height: 20),
            if (_url != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Detected URL', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      SelectableText(_url!, style: const TextStyle(fontFamily: 'monospace')),
                    ],
                  ),
                ),
              ),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
        ),
      ),
    );
  }
}
