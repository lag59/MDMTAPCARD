import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/api_client.dart';

class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _clients = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final clients = await ApiClient.getClients();
      if (!mounted) return;
      setState(() => _clients = clients);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not load clients. Pull down to retry.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Clients')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/cards/new'),
        icon: const Icon(Icons.add),
        label: const Text('Create Card'),
      ),
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
    if (_error != null) {
      return ListView(
        children: [ListTile(title: Text(_error!))],
      );
    }
    if (_clients.isEmpty) {
      return ListView(
        children: const [
          ListTile(
            title: Text('No clients yet'),
            subtitle: Text('Create your first client and card profile.'),
          ),
        ],
      );
    }
    return ListView.builder(
      itemCount: _clients.length,
      itemBuilder: (context, i) {
        final client = _clients[i] as Map<String, dynamic>;
        final isActive = client['is_active'] == true;
        return ListTile(
          leading: CircleAvatar(child: Text((client['display_name'] as String? ?? '?').substring(0, 1))),
          title: Text(client['display_name'] as String? ?? 'Unnamed'),
          subtitle: Text(client['company_name'] as String? ?? ''),
          trailing: Icon(Icons.circle, size: 10, color: isActive ? Colors.green : Colors.grey),
          onTap: () => context.push('/clients/${client['slug']}'),
        );
      },
    );
  }
}
