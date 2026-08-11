import 'package:flutter/material.dart';

class ProviderOnboardingSheetFrame extends StatelessWidget {
  const ProviderOnboardingSheetFrame({
    super.key,
    required this.title,
    required this.child,
    this.description,
  });

  final String title;
  final String? description;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 4, 20, bottomInset + 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            if (description != null) ...[
              const SizedBox(height: 8),
              Text(description!),
            ],
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }
}

class ProviderOnboardingField extends StatelessWidget {
  const ProviderOnboardingField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.required = false,
    this.keyboardType,
    this.maxLines = 1,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final bool required;
  final TextInputType? keyboardType;
  final int maxLines;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        maxLines: maxLines,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          border: const OutlineInputBorder(),
        ),
        validator: validator ??
            (value) {
              if (required && (value == null || value.trim().isEmpty)) {
                return 'Vui lòng nhập $label.';
              }
              return null;
            },
      ),
    );
  }
}

class ProviderOnboardingSubmitButton extends StatelessWidget {
  const ProviderOnboardingSubmitButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: onPressed,
      icon: const Icon(Icons.check),
      label: Text(label),
    );
  }
}
