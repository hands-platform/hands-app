const providerAgreementTypes = [
  'TERMS',
  'PRIVACY',
  'LOCATION',
  'PAYOUT',
  'TAX',
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
    required this.experienceYears,
    required this.specialties,
    required this.languages,
    required this.serviceStyle,
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
  final int? experienceYears;
  final List<String> specialties;
  final List<String> languages;
  final String serviceStyle;
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
      'experienceYears': experienceYears,
      'specialties': specialties,
      'languages': languages,
      'serviceStyle': serviceStyle,
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
