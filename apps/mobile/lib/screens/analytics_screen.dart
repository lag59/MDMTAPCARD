import 'package:flutter/material.dart';
import '../services/api_client.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _overview;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final overview = await ApiClient.getAnalyticsOverview();
      if (!mounted) return;
      setState(() => _overview = overview);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not load analytics. Pull down to retry.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Analytics')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null || _overview == null) {
      return ListView(
        children: [ListTile(title: Text(_error ?? 'No analytics available.'))],
      );
    }
    final byEventType = (_overview!['by_event_type'] as Map<String, dynamic>?) ?? {};
    final totalLeads = _overview!['total_leads'] as int? ?? 0;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _MetricTile(title: 'Page Views', value: '${byEventType['direct_visit'] ?? 0}'),
        _MetricTile(title: 'NFC Taps', value: '${byEventType['nfc_tap'] ?? 0}'),
        _MetricTile(title: 'QR Scans', value: '${byEventType['qr_scan'] ?? 0}'),
        _MetricTile(title: 'Lead Form Submissions', value: '$totalLeads'),
      ],
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
