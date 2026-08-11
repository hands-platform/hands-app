import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/earnings/presentation/provider_earnings_screen.dart';

void main() {
  group('providerTaxWithholdingAmount', () {
    test('reads the canonical API withholdingAmount field', () {
      expect(
        providerTaxWithholdingAmount(
          <String, dynamic>{'withholdingAmount': 35000},
        ),
        35000,
      );
    });

    test('keeps the legacy taxAmount response compatible', () {
      expect(
        providerTaxWithholdingAmount(<String, dynamic>{'taxAmount': 20000}),
        20000,
      );
    });

    test('uses the canonical value when both fields are present', () {
      expect(
        providerTaxWithholdingAmount(
          <String, dynamic>{
            'withholdingAmount': 35000,
            'taxAmount': 0,
          },
        ),
        35000,
      );
    });
  });

  test('formats partner wallet withdrawal states for the earnings screen', () {
    expect(
      providerWalletWithdrawalStatusLabel('NEEDS_BANK_CORRECTION'),
      'Cần sửa thông tin ngân hàng',
    );
    expect(
      providerWalletWithdrawalStatusLabel('BANK_TRANSFER_PENDING'),
      'Đang chờ chuyển khoản ngân hàng',
    );
    expect(providerWalletWithdrawalStatusLabel('PAID'), 'Đã thanh toán');
  });
}
