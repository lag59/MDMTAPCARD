import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/api_client.dart';

class NfcInventoryScreen extends StatefulWidget {
  const NfcInventoryScreen({super.key});

  @override
  State<NfcInventoryScreen> createState() => _NfcInventoryScreenState();
}

class _NfcInventoryScreenState extends State<NfcInventoryScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _rows = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiClient.getInventory();
      if (!mounted) return;
      setState(() => _rows = data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load NFC inventory.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _countByStatus(String status) => _rows.where((r) => (r['status'] ?? '') == status).length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('NFC Inventory')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              _StatCard(label: 'Verified', value: '${_countByStatus('verified')}', color: Colors.green),
              const SizedBox(width: 10),
              _StatCard(label: 'Failed', value: '${_countByStatus('failed')}', color: Colors.red),
              const SizedBox(width: 10),
              _StatCard(label: 'Replaced', value: '${_countByStatus('replaced')}', color: Colors.orange),
            ],
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Card(child: ListTile(title: Text('Loading NFC inventory…')))
          else if (_error != null)
            Card(child: ListTile(title: const Text('Error'), subtitle: Text(_error!)))
          else if (_rows.isEmpty)
            const Card(
              child: ListTile(
                title: Text('No tags programmed yet.'),
                subtitle: Text('Use Program NFC Card on a customer card to write the first NFC tag.'),
              ),
            )
          else
            ..._rows.map((row) => Card(
                  child: ListTile(
                    title: Text(row['profile_name']?.toString() ?? row['profile_slug']?.toString() ?? 'Unknown profile'),
                    subtitle: Text(
                      'Status: ${row['status'] ?? 'unknown'} • Type: ${row['tag_type'] ?? 'N/A'}\nCard #: ${row['card_number'] ?? '—'}',
                    ),
                    trailing: row['profile_id'] != null
                        ? TextButton(
                            onPressed: () => context.push('/cards/${row['profile_id']}/program-nfc'),
                            child: const Text('Program'),
                          )
                        : null,
                  ),
                )),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: color.withValues(alpha: 0.08),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
