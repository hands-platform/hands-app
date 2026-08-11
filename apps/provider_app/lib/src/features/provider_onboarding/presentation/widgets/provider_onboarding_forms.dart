import 'package:flutter/material.dart';

export 'provider_onboarding_form_inputs.dart';

import 'provider_onboarding_form_inputs.dart';
import 'provider_onboarding_form_widgets.dart';

const partnerBankCorrectionDefaultReason =
    'Thông tin ngân hàng nhận tiền không chính xác nên chưa thể chuyển khoản.';

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
  String? status,
  String? rejectionReason,
}) {
  return showModalBottomSheet<ProviderBankAccountInput>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _BankAccountForm(
      initial: initial,
      status: status,
      rejectionReason: rejectionReason,
    ),
  );
}

Future<ProviderTaxProfileInput?> showProviderTaxProfileSheet(
  BuildContext context, {
  Map<String, dynamic> initial = const {},
  Map<String, dynamic> basicProfile = const {},
  String? status,
  String? rejectionReason,
}) {
  return showModalBottomSheet<ProviderTaxProfileInput>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _TaxProfileForm(
      initial: initial,
      basicProfile: basicProfile,
      status: status,
      rejectionReason: rejectionReason,
    ),
  );
}

Future<ProviderAgreementsInput?> showProviderAgreementsSheet(
  BuildContext context, {
  List<dynamic> accepted = const [],
  List<String> requiredTypes = providerAgreementTypes,
  required String version,
}) {
  return showModalBottomSheet<ProviderAgreementsInput>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _AgreementsForm(
      accepted: accepted,
      requiredTypes: requiredTypes,
      version: version,
    ),
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
  late final TextEditingController experienceYears;
  late final TextEditingController specialties;
  late final TextEditingController languages;
  late final TextEditingController serviceStyle;
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
    experienceYears = _controller(widget.initial['experienceYears']);
    specialties = TextEditingController(
      text: _jsonListText(widget.initial['specialties']),
    );
    languages = TextEditingController(
      text: _jsonListText(widget.initial['languages']),
    );
    serviceStyle = _controller(widget.initial['serviceStyle']);
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
    experienceYears.dispose();
    specialties.dispose();
    languages.dispose();
    serviceStyle.dispose();
    residentialAddress.dispose();
    city.dispose();
    serviceCities.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ProviderOnboardingSheetFrame(
      title: 'Hồ sơ cơ bản',
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            ProviderOnboardingField(
                controller: legalName, label: 'Họ tên pháp lý', required: true),
            ProviderOnboardingField(
                controller: displayName, label: 'Tên hiển thị công khai'),
            ProviderOnboardingField(
              controller: dateOfBirth,
              label: 'Ngày sinh',
              hint: 'NNNN-TT-NG',
              required: true,
            ),
            ProviderOnboardingField(
              controller: gender,
              label: 'Giới tính',
              hint: 'nữ, nam, khác',
            ),
            ProviderOnboardingField(controller: facebookId, label: 'Facebook'),
            ProviderOnboardingField(
                controller: activityNickname, label: 'Tên hoạt động'),
            ProviderOnboardingField(
                controller: bio, label: 'Giới thiệu', maxLines: 3),
            ProviderOnboardingField(
              controller: experienceYears,
              label: 'Số năm kinh nghiệm',
              hint: '4',
              keyboardType: TextInputType.number,
            ),
            ProviderOnboardingField(
              controller: specialties,
              label: 'Chuyên môn',
              hint: 'Massage chân, massage Thụy Điển',
            ),
            ProviderOnboardingField(
              controller: languages,
              label: 'Ngôn ngữ',
              hint: 'Tiếng Việt, tiếng Anh',
            ),
            ProviderOnboardingField(
              controller: serviceStyle,
              label: 'Phong cách phục vụ',
              hint: 'Yên tĩnh, chuyên nghiệp, phù hợp khách sạn',
              maxLines: 2,
            ),
            ProviderOnboardingField(
              controller: residentialAddress,
              label: 'Địa chỉ cư trú',
              hint: 'Cần sau thu nhập đầu tiên, trước khi rút tiền',
              maxLines: 2,
            ),
            ProviderOnboardingField(
                controller: city, label: 'Tỉnh / thành phố', required: true),
            ProviderOnboardingField(
              controller: serviceCities,
              label: 'Khu vực phục vụ',
              hint: 'TP. Hồ Chí Minh, Đà Nẵng',
            ),
            const SizedBox(height: 12),
            ProviderOnboardingSubmitButton(
              label: 'Lưu hồ sơ cơ bản',
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
                    experienceYears: int.tryParse(experienceYears.text.trim()),
                    specialties: _splitCsv(specialties.text, ''),
                    languages: _splitCsv(languages.text, 'Tiếng Việt'),
                    serviceStyle: serviceStyle.text.trim(),
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
    return ProviderOnboardingSheetFrame(
      title: 'Xác minh danh tính KYC',
      description:
          'Nhập số CCCD/CMND sau khi đã chuẩn bị mặt trước, mặt sau và ảnh chân dung.',
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            ProviderOnboardingField(
              controller: cccdNumber,
              label: 'Số CCCD / CMND',
              keyboardType: TextInputType.number,
              required: true,
              validator: (value) {
                final text = value?.trim() ?? '';
                if (text.length < 9) return 'Vui lòng nhập số giấy tờ hợp lệ.';
                return null;
              },
            ),
            const SizedBox(height: 12),
            ProviderOnboardingSubmitButton(
              label: 'Gửi KYC để xét duyệt',
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
  const _BankAccountForm({
    required this.initial,
    required this.status,
    required this.rejectionReason,
  });

  final Map<String, dynamic> initial;
  final String? status;
  final String? rejectionReason;

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
    return ProviderOnboardingSheetFrame(
      title: 'Tài khoản ngân hàng nhận tiền',
      description: bankAccountFormDescription(
        status: widget.status,
        rejectionReason: widget.rejectionReason,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            ProviderOnboardingField(
              controller: bankName,
              label: 'Tên ngân hàng Việt Nam',
              required: true,
            ),
            ProviderOnboardingField(
              controller: accountNumber,
              label: 'Số tài khoản ngân hàng',
              keyboardType: TextInputType.number,
              required: true,
            ),
            ProviderOnboardingField(
              controller: accountHolderName,
              label: 'Họ tên chủ tài khoản',
              required: true,
            ),
            ProviderOnboardingField(
              controller: qrBankingProvider,
              label: 'Nhà cung cấp QR / VietQR',
              hint: 'vietqr',
            ),
            const SizedBox(height: 12),
            ProviderOnboardingSubmitButton(
              label: 'Gửi thông tin ngân hàng',
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
  const _TaxProfileForm({
    required this.initial,
    required this.basicProfile,
    required this.status,
    required this.rejectionReason,
  });

  final Map<String, dynamic> initial;
  final Map<String, dynamic> basicProfile;
  final String? status;
  final String? rejectionReason;

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
    return ProviderOnboardingSheetFrame(
      title: 'Thông tin thuế',
      description: taxProfileFormDescription(
        status: widget.status,
        rejectionReason: widget.rejectionReason,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            ProviderOnboardingField(
                controller: taxCode, label: 'MST / mã số thuế cá nhân'),
            ProviderOnboardingField(
                controller: legalName, label: 'Họ tên pháp lý', required: true),
            ProviderOnboardingField(
              controller: registeredAddress,
              label: 'Địa chỉ đăng ký',
              required: true,
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            ProviderOnboardingSubmitButton(
              label: 'Gửi thông tin thuế',
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
  const _AgreementsForm({
    required this.accepted,
    required this.requiredTypes,
    required this.version,
  });

  final List<dynamic> accepted;
  final List<String> requiredTypes;
  final String version;

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
    version = TextEditingController(text: widget.version);
    deviceId = TextEditingController();
    final acceptedTypes = widget.accepted
        .whereType<Map>()
        .map((item) => item['type']?.toString())
        .whereType<String>()
        .toSet();
    selected = {
      for (final type in widget.requiredTypes)
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
    return ProviderOnboardingSheetFrame(
      title: 'Thỏa thuận bắt buộc',
      description:
          'Phiên bản thỏa thuận được lưu để yêu cầu đồng ý lại khi chính sách thay đổi.',
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            ProviderOnboardingField(
                controller: version, label: 'Phiên bản thỏa thuận'),
            ProviderOnboardingField(
              controller: deviceId,
              label: 'Mã thiết bị',
              hint: 'Không bắt buộc',
            ),
            const SizedBox(height: 8),
            for (final type in widget.requiredTypes)
              CheckboxListTile(
                value: selected[type] ?? false,
                onChanged: (value) => setState(() {
                  selected[type] = value ?? false;
                }),
                title: Text(_agreementLabel(type)),
                subtitle: Text('Loại: $type'),
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
              ),
            const SizedBox(height: 12),
            ProviderOnboardingSubmitButton(
              label: 'Chấp nhận thỏa thuận đã chọn',
              onPressed: () {
                final chosen = selected.entries
                    .where((entry) => entry.value)
                    .map((entry) => entry.key)
                    .toList();
                if (chosen.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Hãy chọn ít nhất một thỏa thuận.')),
                  );
                  return;
                }
                Navigator.of(context).pop(
                  ProviderAgreementsInput(
                    types: chosen,
                    version: _fallback(version.text, widget.version),
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

String _jsonListText(dynamic value) {
  if (value is List) {
    return value.map((item) => item.toString()).join(', ');
  }
  return value?.toString() ?? '';
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
      return 'Điều khoản dịch vụ';
    case 'PRIVACY':
      return 'Thu thập dữ liệu riêng tư';
    case 'LOCATION':
      return 'Sử dụng vị trí';
    case 'PAYOUT':
      return 'Chính sách thanh toán';
    case 'TAX':
      return 'Xử lý thuế';
    default:
      return type;
  }
}

String bankAccountFormDescription({
  required String? status,
  String? rejectionReason,
}) {
  if (status == 'REJECTED') {
    final reason = rejectionReason?.trim();
    final prefix = reason == null || reason.isEmpty
        ? partnerBankCorrectionDefaultReason
        : 'Bị từ chối: $reason.';
    return '$prefix Hãy sửa thông tin tài khoản ngân hàng Việt Nam và gửi lại.';
  }
  if (status == 'PENDING_REVIEW') {
    return 'Tài khoản ngân hàng đang chờ xét duyệt. Bạn có thể cập nhật nếu đã đổi tài khoản.';
  }
  if (status == 'APPROVED') {
    return 'Tài khoản ngân hàng đã được duyệt. Chỉ gửi lại khi thông tin thay đổi.';
  }
  return 'Hãy dùng tài khoản ngân hàng Việt Nam chính chủ. Cần được duyệt trước khi nhận tiền.';
}

String taxProfileFormDescription({
  required String? status,
  String? rejectionReason,
}) {
  if (status == 'REJECTED') {
    final reason = rejectionReason?.trim();
    final prefix = reason == null || reason.isEmpty
        ? 'Bị từ chối.'
        : 'Bị từ chối: $reason.';
    return '$prefix Hãy sửa MST, họ tên pháp lý và địa chỉ đăng ký trước khi rút tiền.';
  }
  if (status == 'PENDING_REVIEW') {
    return 'Thông tin thuế đang chờ xét duyệt. Mức thuế vẫn theo chính sách của HANDS.';
  }
  if (status == 'APPROVED') {
    return 'Thông tin thuế đã được duyệt. Chỉ cập nhật khi thông tin thay đổi.';
  }
  return 'Thông tin thuế được yêu cầu sau khi có thu nhập đầu tiên. Mức thuế do HANDS quản lý.';
}
