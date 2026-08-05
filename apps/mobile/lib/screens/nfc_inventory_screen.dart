import 'package:flutter/material.dart';

class NfcInventoryScreen extends StatelessWidget {
  const NfcInventoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('NFC Inventory')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Row(
            children: [
              _StatCard(label: 'Activated', value: '0', color: Colors.green),
              SizedBox(width: 10),
              _StatCard(label: 'Failed', value: '0', color: Colors.red),
              SizedBox(width: 10),
              _StatCard(label: 'Replacements', value: '0', color: Colors.orange),
            ],
          ),
          SizedBox(height: 16),
          Card(
            child: ListTile(
              title: Text('No inventory records yet'),
              subtitle: Text('Written tags, serial numbers, and programmer logs will appear here.'),
            ),
          ),
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
