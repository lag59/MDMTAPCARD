import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/api_client.dart';

class ClientDetailScreen extends StatefulWidget {
  final String slug;
  const ClientDetailScreen({super.key, required this.slug});

  @override
  State<ClientDetailScreen> createState() => _ClientDetailScreenState();
}

class _ClientDetailScreenState extends State<ClientDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _profile;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final profile = await ApiClient.getProfileForEdit(widget.slug);
      if (!mounted) return;
      setState(() => _profile = profile);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not load this client. Pull down to retry.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Client Details')),
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
    if (_error != null || _profile == null) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [ListTile(title: Text(_error ?? 'Client not found.'))],
      );
    }
    final profile = _profile!;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            title: Text(profile['display_name'] as String? ?? 'Unnamed'),
            subtitle: Text(profile['title'] as String? ?? ''),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Column(
            children: [
              ListTile(leading: const Icon(Icons.email), title: Text(profile['email'] as String? ?? '—')),
              ListTile(leading: const Icon(Icons.phone), title: Text(profile['phone'] as String? ?? '—')),
              ListTile(
                leading: const Icon(Icons.badge_outlined),
                title: Text((profile['card_type'] as String? ?? 'digital_only').replaceAll('_', ' ')),
              ),
              ListTile(
                leading: Icon(
                  profile['is_active'] == true ? Icons.check_circle : Icons.pause_circle,
                  color: profile['is_active'] == true ? Colors.green : Colors.grey,
                ),
                title: Text(profile['is_active'] == true ? 'Active' : 'Inactive'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: () => context.push('/cards/new'),
          icon: const Icon(Icons.badge_outlined),
          label: const Text('Create Digital Card'),
        ),
      ],
    );
  }
}
