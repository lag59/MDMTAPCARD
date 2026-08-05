import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ClientsScreen extends StatelessWidget {
  const ClientsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Clients')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/cards/new'),
        icon: const Icon(Icons.add),
        label: const Text('Create Card'),
      ),
      body: ListView(
        children: const [
          ListTile(
            title: Text('No clients yet'),
            subtitle: Text('Create your first client and card profile.'),
          ),
        ],
      ),
    );
  }
}
