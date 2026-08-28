import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/api_client.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _canProgramNfc = false;

  @override
  void initState() {
    super.initState();
    ApiClient.canProgramNfc().then((allowed) {
      if (!mounted) return;
      setState(() => _canProgramNfc = allowed);
    });
  }

  @override
  Widget build(BuildContext context) {
    final cards = <(String, IconData, String)>[
      ('Clients', Icons.business, '/clients'),
      ('Create Card', Icons.badge_outlined, '/cards/new'),
      ('Analytics', Icons.query_stats, '/analytics'),
      ('Settings', Icons.settings, '/settings'),
    ];

    if (_canProgramNfc) {
      cards.insert(2, ('Program NFC Card', Icons.nfc, '/nfc/inventory'));
    }

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
