import 'package:flutter/material.dart';

class AnalyticsScreen extends StatelessWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Analytics')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          _MetricTile(title: 'Page Views', value: '0'),
          _MetricTile(title: 'NFC Taps', value: '0'),
          _MetricTile(title: 'QR Scans', value: '0'),
          _MetricTile(title: 'Contact Downloads', value: '0'),
          _MetricTile(title: 'Lead Form Submissions', value: '0'),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String title;
  final String value;
  const _MetricTile({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(title),
        trailing: Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
