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
  final _whatsapp = TextEditingController();
  final _address = TextEditingController();
  final _about = TextEditingController();

  bool _isEs = false;
  bool _isActive = true;
  bool _loading = false;
  String _cardType = 'digital_only';

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
        'whatsapp_number': _whatsapp.text.trim().isEmpty
            ? null
            : _whatsapp.text.trim(),
        'address': _address.text.trim().isEmpty ? null : _address.text.trim(),
        'biography': _about.text.trim().isEmpty ? null : _about.text.trim(),
        'language': _isEs ? 'es' : 'en',
        'is_active': _isActive,
        'card_type': _cardType,
        'social_links': [],
      });

      if (!mounted) return;

      final profileId = profile['id'];

      if (profileId == null) {
        throw Exception('Profile was created but no profile ID was returned.');
      }

      context.push('/cards/$profileId/preview');
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error creating card: $e'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _title.dispose();
    _company.dispose();
    _phone.dispose();
    _email.dispose();
    _website.dispose();
    _whatsapp.dispose();
    _address.dispose();
    _about.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Digital Card'),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: _name,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Name',
                  hintText: 'Enter full name',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Name is required';
                  }

                  return null;
                },
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _title,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Job Title / Position',
                  hintText: 'Example: CEO',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _company,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Company',
                  hintText: 'Enter company name',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Phone',
                  hintText: 'Example: 919-555-1234',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  hintText: 'name@company.com',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.email_outlined),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return null;
                  }

                  final email = value.trim();

                  final emailPattern = RegExp(
                    r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                  );

                  if (!emailPattern.hasMatch(email)) {
                    return 'Enter a valid email address';
                  }

                  return null;
                },
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _website,
                keyboardType: TextInputType.url,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Website',
                  hintText: 'https://example.com',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.language),
                ),
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _whatsapp,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'WhatsApp Number',
                  hintText: 'Example: 19195551234',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.chat_outlined),
                ),
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _address,
                keyboardType: TextInputType.streetAddress,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Address',
                  hintText: 'Business or mailing address',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.location_on_outlined),
                ),
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _about,
                maxLines: 5,
                minLines: 3,
                decoration: const InputDecoration(
                  labelText: 'About / Biography',
                  hintText: 'Tell visitors about this person or business',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 16),

              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('CARD TYPE', style: Theme.of(context).textTheme.labelLarge),
                      const SizedBox(height: 10),
                      RadioGroup<String>(
                        groupValue: _cardType,
                        onChanged: (value) {
                          if (value == null) return;
                          setState(() => _cardType = value);
                        },
                        child: const Column(
                          children: [
                            RadioListTile<String>(
                              value: 'digital_only',
                              title: Text('Digital Card Only'),
                              subtitle: Text('Share by link or QR code. No physical NFC product required.'),
                            ),
                            RadioListTile<String>(
                              value: 'nfc_card',
                              title: Text('NFC TapCard'),
                              subtitle: Text('A full-size NFC business card that opens your digital profile with a tap.'),
                            ),
                            RadioListTile<String>(
                              value: 'nfc_button',
                              title: Text('NFC TapButton'),
                              subtitle: Text('A compact adhesive NFC button that sticks to your phone, case, badge, counter, or display.'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),

              Card(
                child: SwitchListTile(
                  value: _isEs,
                  onChanged: (value) {
                    setState(() => _isEs = value);
                  },
                  title: const Text('Spanish Profile'),
                  subtitle: const Text(
                    'Enable Spanish as the default card language',
                  ),
                  secondary: const Icon(Icons.translate),
                ),
              ),
              const SizedBox(height: 8),

              Card(
                child: SwitchListTile(
                  value: _isActive,
                  onChanged: (value) {
                    setState(() => _isActive = value);
                  },
                  title: const Text('Active'),
                  subtitle: const Text(
                    'Allow this digital card to be publicly visible',
                  ),
                  secondary: const Icon(Icons.visibility_outlined),
                ),
              ),
              const SizedBox(height: 24),

              SizedBox(
                height: 52,
                child: FilledButton.icon(
                  onPressed: _loading ? null : _submit,
                  icon: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.add_card),
                  label: Text(
                    _loading ? 'Creating Card...' : 'Create Card Profile',
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}