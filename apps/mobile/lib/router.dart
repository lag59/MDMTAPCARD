import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'screens/sign_in_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/clients_screen.dart';
import 'screens/client_detail_screen.dart';
import 'screens/create_card_screen.dart';
import 'screens/card_preview_screen.dart';
import 'screens/write_nfc_screen.dart';
import 'screens/verify_nfc_screen.dart';
import 'screens/nfc_inventory_screen.dart';
import 'screens/analytics_screen.dart';
import 'screens/settings_screen.dart';
import 'services/api_client.dart';

Future<String?> _adminOnlyRedirect() async {
  final allowed = await ApiClient.canProgramNfc();
  return allowed ? null : '/dashboard';
}

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/signin',
    routes: [
      GoRoute(path: '/signin', builder: (ctx, state) => const SignInScreen()),
      GoRoute(path: '/dashboard', builder: (ctx, state) => const DashboardScreen()),
      GoRoute(path: '/clients', builder: (ctx, state) => const ClientsScreen()),
      GoRoute(
        path: '/clients/:slug',
        builder: (ctx, state) => ClientDetailScreen(slug: state.pathParameters['slug']!),
      ),
      GoRoute(path: '/cards/new', builder: (ctx, state) => const CreateCardScreen()),
      GoRoute(
        path: '/cards/:id/preview',
        builder: (ctx, state) => CardPreviewScreen(profileId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/cards/:profileId/program-nfc',
        redirect: (ctx, state) async => _adminOnlyRedirect(),
        builder: (ctx, state) => WriteNfcScreen(profileId: state.pathParameters['profileId']!),
      ),
      GoRoute(
        path: '/nfc/write/:profileId',
        redirect: (ctx, state) async => _adminOnlyRedirect(),
        builder: (ctx, state) => WriteNfcScreen(profileId: state.pathParameters['profileId']!),
      ),
      GoRoute(
        path: '/nfc/verify/:tagId',
        redirect: (ctx, state) async => _adminOnlyRedirect(),
        builder: (ctx, state) => VerifyNfcScreen(tagId: state.pathParameters['tagId']!),
      ),
      GoRoute(
        path: '/nfc/inventory',
        redirect: (ctx, state) async => _adminOnlyRedirect(),
        builder: (ctx, state) => const NfcInventoryScreen(),
      ),
      GoRoute(path: '/analytics', builder: (ctx, state) => const AnalyticsScreen()),
      GoRoute(path: '/settings', builder: (ctx, state) => const SettingsScreen()),
    ],
  );
});
