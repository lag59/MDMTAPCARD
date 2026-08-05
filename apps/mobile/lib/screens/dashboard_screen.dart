import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cards = [
      ('Clients', Icons.business, '/clients'),
      ('Create Card', Icons.badge_outlined, '/cards/new'),
      ('Write NFC', Icons.nfc, '/nfc/write/demo-profile-id'),
      ('NFC Inventory', Icons.inventory_2_outlined, '/nfc/inventory'),
      ('Analytics', Icons.query_stats, '/analytics'),
      ('Settings', Icons.settings, '/settings'),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: cards.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.15,
        ),
        itemBuilder: (context, i) {
          final (title, icon, route) = cards[i];
          return Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => context.push(route),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, size: 34),
                    const SizedBox(height: 10),
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
