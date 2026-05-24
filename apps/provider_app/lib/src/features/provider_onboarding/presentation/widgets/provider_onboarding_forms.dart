import 'package:flutter/material.dart';

const providerAgreementTypes = [
  'TERMS',
  'PRIVACY',
  'LOCATION',
  'PAYOUT',
  'TAX'
];

class ProviderBasicProfileInput {
  const ProviderBasicProfileInput({
    required this.legalName,
    required this.displayName,
    required this.dateOfBirth,
    required this.gender,
    required this.facebookId,
    required this.activityNickname,
    required this.bio,
    required this.residentialAddress,
    required this.city,
    required this.serviceCities,
  });

  final String legalName;
  final String displayName;
  final String dateOfBirth;
  final String gender;
  final String facebookId;
  final String activityNickname;
  final String bio;
  final String residentialAddress;
  final String city;
  final List<String> serviceCities;

  Map<String, dynamic> toJson() {
    return {
      'legalName': legalName,
      'displayName': displayName,
      'dateOfBirth': dateOfBirth,
      'gender': gender,
      'facebookId': facebookId,
      'activityNickname': activityNickname,
      'bio': bio,
      'residentialAddress': residentialAddress,
      'city': city,
      'serviceArea': {
        'country': 'VN',
        'cities': serviceCities,
      },
    };
  }
}

class ProviderKycInput {
  const ProviderKycInput({required this.cccdNumber});

  final String cccdNumber;
}

class ProviderBankAccountInput {
  const ProviderBankAccountInput({
    required this.bankName,
    required this.accountNumber,
    required this.accountHolderName,
    required this.qrBankingProvider,
  });

  final String bankName;
  final String accountNumber;
  final String accountHolderName;
  final String qrBankingProvider;

  Map<String, dynamic> get qrBankingInfo {
    return {
      'provider': qrBankingProvider,
      'enabled': qrBankingProvider.trim().isNotEmpty,
    };
  }
}

class ProviderTaxProfileInput {
  const ProviderTaxProfileInput({
    required this.taxCode,
    required this.legalName,
    required this.registeredAddress,
  });

  final String taxCode;
  final String legalName;
  final String registeredAddress;
}

class ProviderAgreementsInput {
  const ProviderAgreementsInput({
    required this.types,
    required this.version,
    required this.deviceId,
  });

  final List<String> types;
  final String version;
  final String deviceId;
}

Future<ProviderBasicProfileInput?> showProviderBasicProfileSheet(
  BuildContext context, {
  Map<String, dynamic> initial = const {},
}) {
  return showModalBottomSheet<ProviderBasicProfileInput>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _BasicProfileForm(initial: initial),
  );
}

Future<ProviderKycInput?> showProviderKycSheet(BuildContext context) {
  return showModalBottomSheet<ProviderKycInput>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => const _KycForm(),
  );
}

Future<ProviderBankAccountInput?> showProviderBankAccountSheet(
  BuildContext context, {
  Map<String, dynamic> initial = const {},
}) {
  return showModalBottomSheet<ProviderBankAccountInput>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _BankAccountForm(initial: initial),
  );
}

Future<ProviderTaxProfileInput?> showProviderTaxProfileSheet(
  BuildContext context, {
  Map<String, dynamic> initial = const {},
  Map<String, dynamic> basicProfile = const {},
}) {
  return showModalBottomSheet<ProviderTaxProfileInput>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) =>
        _TaxProfileForm(initial: initial, basicProfile: basicProfile),
  );
}

Future<ProviderAgreementsInput?> showProviderAgreementsSheet(
  BuildContext context, {
  List<dynamic> accepted = const [],
}) {
  return showModalBottomSheet<ProviderAgreementsInput>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _AgreementsForm(accepted: accepted),
  );
}

class _BasicProfileForm extends StatefulWidget {
  const _BasicProfileForm({required this.initial});

  final Map<String, dynamic> initial;

  @override
  State<_BasicProfileForm> createState() => _BasicProfileFormState();
}

class _BasicProfileFormState extends State<_BasicProfileForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController legalName;
  late final TextEditingController displayName;
  late final TextEditingController dateOfBirth;
  late final TextEditingController gender;
  late final TextEditingController facebookId;
  late final TextEditingController activityNickname;
  late final TextEditingController bio;
  late final TextEditingController residentialAddress;
  late final TextEditingController city;
  late final TextEditingController serviceCities;

  @override
  void initState() {
    super.initState();
    legalName = _controller(widget.initial['legalName']);
    displayName = _controller(widget.initial['displayName']);
    dateOfBirth = _controller(widget.initial['dateOfBirth']);
    gender = _controller(widget.initial['gender']);
    facebookId = _controller(widget.initial['facebookId']);
    activityNickname = _controller(widget.initial['activityNickname']);
    bio = _controller(widget.initial['bio']);
    residentialAddress = _controller(widget.initial['residentialAddress']);
    city = _controller(widget.initial['city']);
    final serviceArea = widget.initial['serviceArea'];
    final serviceCityValue = serviceArea is Map<String, dynamic>
        ? serviceArea['cities']
        : serviceArea is Map
            ? serviceArea['cities']
            : null;
    serviceCities = TextEditingController(
      text: serviceCityValue is List
          ? serviceCityValue.map((value) => value.toString()).join(', ')
          : city.text,
    );
  }

  @override
  void dispose() {
    legalName.dispose();
    displayName.dispose();
    dateOfBirth.dispose();
    gender.dispose();
    facebookId.dispose();
    activityNickname.dispose();
    bio.dispose();
    residentialAddress.dispose();
    city.dispose();
    serviceCities.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      title: 'Provider basic profile',
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            _Field(controller: legalName, label: 'Legal name', required: true),
            _Field(controller: displayName, label: 'Public display name'),
            _Field(
              controller: dateOfBirth,
              label: 'Date of birth',
              hint: 'YYYY-MM-DD',
              required: true,
            ),
            _Field(
              controller: gender,
              label: 'Gender',
              hint: 'female, male, other',
            ),
            _Field(controller: facebookId, label: 'Facebook ID'),
            _Field(controller: activityNickname, label: 'Activity nickname'),
            _Field(controller: bio, label: 'Bio', maxLines: 3),
            _Field(
              controller: residentialAddress,
              label: 'Residential address',
              required: true,
              maxLines: 2,
            ),
            _Field(controller: city, label: 'City / province', required: true),
            _Field(
              controller: serviceCities,
              label: 'Service cities',
              hint: 'Ho Chi Minh City, Da Nang',
            ),
            const SizedBox(height: 12),
            _SubmitButton(
              label: 'Save basic profile',
              onPressed: () {
                if (!_formKey.currentState!.validate()) return;
                Navigator.of(context).pop(
                  ProviderBasicProfileInput(
                    legalName: legalName.text.trim(),
                    displayName: _fallback(displayName.text, legalName.text),
                    dateOfBirth: dateOfBirth.text.trim(),
                    gender: gender.text.trim(),
                    facebookId: facebookId.text.trim(),
                    activityNickname:
                        _fallback(activityNickname.text, displayName.text),
                    bio: bio.text.trim(),
                    residentialAddress: residentialAddress.text.trim(),
                    city: city.text.trim(),
                    serviceCities: _splitCsv(serviceCities.text, city.text),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _KycForm extends StatefulWidget {
  const _KycForm();

  @override
  State<_KycForm> createState() => _KycFormState();
}

class _KycFormState extends State<_KycForm> {
  final _formKey = GlobalKey<FormState>();
  final cccdNumber = TextEditingController();

  @override
  void dispose() {
    cccdNumber.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      title: 'KYC identity check',
      description:
          'Enter the provider CCCD/CMND number. ID images can be uploaded from the verification section below.',
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            _Field(
              controller: cccdNumber,
              label: 'CCCD / CMND number',
              keyboardType: TextInputType.number,
              required: true,
              validator: (value) {
                final text = value?.trim() ?? '';
                if (text.length < 9) return 'Enter a valid ID number.';
                return null;
              },
            ),
            const SizedBox(height: 12),
            _SubmitButton(
              label: 'Submit KYC for review',
              onPressed: () {
                if (!_formKey.currentState!.validate()) return;
                Navigator.of(context).pop(
                  ProviderKycInput(cccdNumber: cccdNumber.text.trim()),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _BankAccountForm extends StatefulWidget {
  const _BankAccountForm({required this.initial});

  final Map<String, dynamic> initial;

  @override
  State<_BankAccountForm> createState() => _BankAccountFormState();
}

class _BankAccountFormState extends State<_BankAccountForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController bankName;
  late final TextEditingController accountNumber;
  late final TextEditingController accountHolderName;
  late final TextEditingController qrBankingProvider;

  @override
  void initState() {
    super.initState();
    bankName = _controller(widget.initial['bankName']);
    accountNumber = _controller(widget.initial['accountNumber']);
    accountHolderName = _controller(widget.initial['accountHolderName']);
    final qr = widget.initial['qrBankingInfo'];
    qrBankingProvider = TextEditingController(
      text: qr is Map ? (qr['provider']?.toString() ?? 'vietqr') : 'vietqr',
    );
  }

  @override
  void dispose() {
    bankName.dispose();
    accountNumber.dispose();
    accountHolderName.dispose();
    qrBankingProvider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      title: 'Bank account',
      description: 'Submitted accounts require admin approval before payout.',
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            _Field(controller: bankName, label: 'Bank name', required: true),
            _Field(
              controller: accountNumber,
              label: 'Account number',
              keyboardType: TextInputType.number,
              required: true,
            ),
            _Field(
              controller: accountHolderName,
              label: 'Account holder name',
              required: true,
            ),
            _Field(
              controller: qrBankingProvider,
              label: 'QR banking provider',
              hint: 'vietqr',
            ),
            const SizedBox(height: 12),
            _SubmitButton(
              label: 'Submit bank account',
              onPressed: () {
                if (!_formKey.currentState!.validate()) return;
                Navigator.of(context).pop(
                  ProviderBankAccountInput(
                    bankName: bankName.text.trim(),
                    accountNumber: accountNumber.text.trim(),
                    accountHolderName: accountHolderName.text.trim(),
                    qrBankingProvider: qrBankingProvider.text.trim(),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _TaxProfileForm extends StatefulWidget {
  const _TaxProfileForm({required this.initial, required this.basicProfile});

  final Map<String, dynamic> initial;
  final Map<String, dynamic> basicProfile;

  @override
  State<_TaxProfileForm> createState() => _TaxProfileFormState();
}

class _TaxProfileFormState extends State<_TaxProfileForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController taxCode;
  late final TextEditingController legalName;
  late final TextEditingController registeredAddress;

  @override
  void initState() {
    super.initState();
    taxCode = _controller(widget.initial['taxCode']);
    legalName = TextEditingController(
      text: _firstText([
        widget.initial['legalName'],
        widget.basicProfile['legalName'],
      ]),
    );
    registeredAddress = TextEditingController(
      text: _firstText([
        widget.initial['registeredAddress'],
        widget.basicProfile['residentialAddress'],
      ]),
    );
  }

  @override
  void dispose() {
    taxCode.dispose();
    legalName.dispose();
    registeredAddress.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      title: 'Tax profile',
      description:
          'Tax information is required before the provider can withdraw earnings.',
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            _Field(controller: taxCode, label: 'MST / tax code'),
            _Field(controller: legalName, label: 'Legal name', required: true),
            _Field(
              controller: registeredAddress,
              label: 'Registered address',
              required: true,
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            _SubmitButton(
              label: 'Submit tax profile',
              onPressed: () {
                if (!_formKey.currentState!.validate()) return;
                Navigator.of(context).pop(
                  ProviderTaxProfileInput(
                    taxCode: taxCode.text.trim(),
                    legalName: legalName.text.trim(),
                    registeredAddress: registeredAddress.text.trim(),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _AgreementsForm extends StatefulWidget {
  const _AgreementsForm({required this.accepted});

  final List<dynamic> accepted;

  @override
  State<_AgreementsForm> createState() => _AgreementsFormState();
}

class _AgreementsFormState extends State<_AgreementsForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController version;
  late final TextEditingController deviceId;
  late final Map<String, bool> selected;

  @override
  void initState() {
    super.initState();
    version = TextEditingController(text: '2026-05');
    deviceId = TextEditingController();
    final acceptedTypes = widget.accepted
        .whereType<Map>()
        .map((item) => item['type']?.toString())
        .whereType<String>()
        .toSet();
    selected = {
      for (final type in providerAgreementTypes)
        type: !acceptedTypes.contains(type),
    };
  }

  @override
  void dispose() {
    version.dispose();
    deviceId.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      title: 'Required agreements',
      description:
          'Agreement versions are saved so future policy changes can request re-consent.',
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            _Field(controller: version, label: 'Agreement version'),
            _Field(
              controller: deviceId,
              label: 'Device ID',
              hint: 'Optional',
            ),
            const SizedBox(height: 8),
            for (final type in providerAgreementTypes)
              CheckboxListTile(
                value: selected[type] ?? false,
                onChanged: (value) => setState(() {
                  selected[type] = value ?? false;
                }),
                title: Text(_agreementLabel(type)),
                subtitle: Text('Type: $type'),
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
              ),
            const SizedBox(height: 12),
            _SubmitButton(
              label: 'Accept selected agreements',
              onPressed: () {
                final chosen = selected.entries
                    .where((entry) => entry.value)
                    .map((entry) => entry.key)
                    .toList();
                if (chosen.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Select at least one agreement.')),
                  );
                  return;
                }
                Navigator.of(context).pop(
                  ProviderAgreementsInput(
                    types: chosen,
                    version: _fallback(version.text, '2026-05'),
                    deviceId: deviceId.text.trim(),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _SheetFrame extends StatelessWidget {
  const _SheetFrame({
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

class _Field extends StatelessWidget {
  const _Field({
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
                return '$label is required.';
              }
              return null;
            },
      ),
    );
  }
}

class _SubmitButton extends StatelessWidget {
  const _SubmitButton({required this.label, required this.onPressed});

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

TextEditingController _controller(Object? value) {
  return TextEditingController(text: value?.toString() ?? '');
}

String _fallback(String value, String fallback) {
  final trimmed = value.trim();
  if (trimmed.isNotEmpty) return trimmed;
  return fallback.trim();
}

List<String> _splitCsv(String value, String fallback) {
  final source = value.trim().isEmpty ? fallback : value;
  return source
      .split(',')
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toList();
}

String _firstText(List<Object?> values) {
  for (final value in values) {
    final text = value?.toString().trim() ?? '';
    if (text.isNotEmpty) return text;
  }
  return '';
}

String _agreementLabel(String type) {
  switch (type) {
    case 'TERMS':
      return 'Service terms';
    case 'PRIVACY':
      return 'Privacy collection';
    case 'LOCATION':
      return 'Location usage';
    case 'PAYOUT':
      return 'Payout policy';
    case 'TAX':
      return 'Tax processing';
    default:
      return type;
  }
}
