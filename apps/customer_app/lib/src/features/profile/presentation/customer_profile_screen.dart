import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Profile', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            auth == null
                ? 'Not signed in'
                : 'Signed in as ${auth.user['phone']}',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 20),
          const Card(
            child: ListTile(
              title: Text('Saved addresses'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
          const Card(
            child: ListTile(
              title: Text('Wallet'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
          const Card(
            child: ListTile(
              title: Text('Reviews'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
          const Card(
            child: ListTile(
              title: Text('Support'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
          const SizedBox(height: 12),
          if (auth != null)
            OutlinedButton.icon(
              onPressed: () async {
                await ref.read(authControllerProvider.notifier).signOut();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Signed out locally.')),
                  );
                }
              },
              icon: const Icon(Icons.logout),
              label: const Text('Sign out'),
            ),
        ],
      ),
    );
  }
}
