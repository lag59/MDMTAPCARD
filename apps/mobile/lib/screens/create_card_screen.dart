import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/api_client.dart';

class CreateCardScreen extends StatefulWidget {
  const CreateCardScreen({super.key});

  @override
  State<CreateCardScreen> createState() => _CreateCardScreenState();
}

class _CreateCardScreenState extends State<CreateCardScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _title = TextEditingController();
  final _company = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _website = TextEditingController();
  final _about = TextEditingController();
  bool _isEs = false;
  bool _loading = false;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final profile = await ApiClient.createProfile({
        'display_name': _name.text.trim(),
        'title': _title.text.trim().isEmpty ? null : _title.text.trim(),
        'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'email': _email.text.trim().isEmpty ? null : _email.text.trim(),
        'website': _website.text.trim().isEmpty ? null : _website.text.trim(),
        'biography': _about.text.trim().isEmpty ? null : _about.text.trim(),
        'language': _isEs ? 'es' : 'en',
        'social_links': [],
      });
      if (!mounted) return;
      context.push('/cards/${profile['id']}/preview');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Digital Card')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder()),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _title, decoration: const InputDecoration(labelText: 'Job Title', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextFormField(controller: _company, decoration: const InputDecoration(labelText: 'Company', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextFormField(controller: _phone, decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextFormField(controller: _email, decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextFormField(controller: _website, decoration: const InputDecoration(labelText: 'Website', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextFormField(
              controller: _about,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'About', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            SwitchListTile(
              value: _isEs,
              onChanged: (v) => setState(() => _isEs = v),
              title: const Text('Spanish profile'),
              subtitle: const Text('Enable for default Spanish labels'),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Create Card Profile'),
            ),
          ],
        ),
      ),
    );
  }
}
