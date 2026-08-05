import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ClientDetailScreen extends StatelessWidget {
  final String clientId;
  const ClientDetailScreen({super.key, required this.clientId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Client Details')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Client ID: $clientId', style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 12),
            const Card(
              child: ListTile(
                title: Text('Client profile data will load here'),
                subtitle: Text('Company details, cards, and subscription status'),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => context.push('/cards/new'),
              icon: const Icon(Icons.badge_outlined),
              label: const Text('Create Digital Card'),
            ),
          ],
        ),
      ),
    );
  }
}
