import 'package:flutter/material.dart';

@immutable
class HandsColors extends ThemeExtension<HandsColors> {
  const HandsColors({
    required this.canvas,
    required this.surface,
    required this.surfaceMuted,
    required this.ink,
    required this.inkMuted,
    required this.outline,
    required this.primary,
    required this.onPrimary,
    required this.primarySoft,
    required this.mistBlue,
    required this.sand,
    required this.photoMatte,
    required this.error,
    required this.warning,
    required this.success,
  });

  final Color canvas;
  final Color surface;
  final Color surfaceMuted;
  final Color ink;
  final Color inkMuted;
  final Color outline;
  final Color primary;
  final Color onPrimary;
  final Color primarySoft;
  final Color mistBlue;
  final Color sand;
  final Color photoMatte;
  final Color error;
  final Color warning;
  final Color success;

  static const light = HandsColors(
    canvas: Color(0xFFF4F3EE),
    surface: Color(0xFFFBFAF7),
    surfaceMuted: Color(0xFFECEEE9),
    ink: Color(0xFF181A18),
    inkMuted: Color(0xFF6B6F69),
    outline: Color(0xFFD8DAD4),
    primary: Color(0xFF25534D),
    onPrimary: Color(0xFFFFFFFF),
    primarySoft: Color(0xFFDCE9E5),
    mistBlue: Color(0xFFBDD0DA),
    sand: Color(0xFFD8C9B8),
    photoMatte: Color(0xFFE7E2D9),
    error: Color(0xFF9C4038),
    warning: Color(0xFF8A6429),
    success: Color(0xFF356B56),
  );

  static const dark = HandsColors(
    canvas: Color(0xFF111411),
    surface: Color(0xFF171B18),
    surfaceMuted: Color(0xFF202621),
    ink: Color(0xFFF2F3EF),
    inkMuted: Color(0xFFA8ADA6),
    outline: Color(0xFF333934),
    primary: Color(0xFF8FBFB6),
    onPrimary: Color(0xFF11201D),
    primarySoft: Color(0xFF28433E),
    mistBlue: Color(0xFF526972),
    sand: Color(0xFF685C50),
    photoMatte: Color(0xFF292C27),
    error: Color(0xFFE5A39C),
    warning: Color(0xFFD8B477),
    success: Color(0xFF8FC5AC),
  );

  @override
  HandsColors copyWith({
    Color? canvas,
    Color? surface,
    Color? surfaceMuted,
    Color? ink,
    Color? inkMuted,
    Color? outline,
    Color? primary,
    Color? onPrimary,
    Color? primarySoft,
    Color? mistBlue,
    Color? sand,
    Color? photoMatte,
    Color? error,
    Color? warning,
    Color? success,
  }) {
    return HandsColors(
      canvas: canvas ?? this.canvas,
      surface: surface ?? this.surface,
      surfaceMuted: surfaceMuted ?? this.surfaceMuted,
      ink: ink ?? this.ink,
      inkMuted: inkMuted ?? this.inkMuted,
      outline: outline ?? this.outline,
      primary: primary ?? this.primary,
      onPrimary: onPrimary ?? this.onPrimary,
      primarySoft: primarySoft ?? this.primarySoft,
      mistBlue: mistBlue ?? this.mistBlue,
      sand: sand ?? this.sand,
      photoMatte: photoMatte ?? this.photoMatte,
      error: error ?? this.error,
      warning: warning ?? this.warning,
      success: success ?? this.success,
    );
  }

  @override
  HandsColors lerp(covariant HandsColors? other, double t) {
    if (other == null) return this;
    return HandsColors(
      canvas: Color.lerp(canvas, other.canvas, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceMuted: Color.lerp(surfaceMuted, other.surfaceMuted, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      inkMuted: Color.lerp(inkMuted, other.inkMuted, t)!,
      outline: Color.lerp(outline, other.outline, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      onPrimary: Color.lerp(onPrimary, other.onPrimary, t)!,
      primarySoft: Color.lerp(primarySoft, other.primarySoft, t)!,
      mistBlue: Color.lerp(mistBlue, other.mistBlue, t)!,
      sand: Color.lerp(sand, other.sand, t)!,
      photoMatte: Color.lerp(photoMatte, other.photoMatte, t)!,
      error: Color.lerp(error, other.error, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      success: Color.lerp(success, other.success, t)!,
    );
  }
}

extension HandsThemeContext on BuildContext {
  HandsColors get handsColors =>
      Theme.of(this).extension<HandsColors>() ??
      (Theme.of(this).brightness == Brightness.dark
          ? HandsColors.dark
          : HandsColors.light);
}

abstract final class HandsSpacing {
  static const space4 = 4.0;
  static const space8 = 8.0;
  static const space12 = 12.0;
  static const space16 = 16.0;
  static const space20 = 20.0;
  static const space24 = 24.0;
  static const space32 = 32.0;
  static const space40 = 40.0;
  static const space48 = 48.0;
  static const space56 = 56.0;
  static const space64 = 64.0;

  static double screenMargin(double width) => width >= 400 ? space24 : space20;
}

abstract final class HandsShapes {
  static const small = 12.0;
  static const medium = 18.0;
  static const large = 28.0;
  static const sheet = 32.0;
  static const full = 999.0;

  static BorderRadius portrait({required TextDirection textDirection}) {
    final left = const BorderRadius.only(
      topLeft: Radius.circular(large),
      bottomLeft: Radius.circular(large),
      topRight: Radius.circular(small),
      bottomRight: Radius.circular(small),
    );
    return textDirection == TextDirection.rtl
        ? BorderRadius.only(
            topLeft: left.topRight,
            bottomLeft: left.bottomRight,
            topRight: left.topLeft,
            bottomRight: left.bottomLeft,
          )
        : left;
  }
}

abstract final class HandsIconTheme {
  static const metadata = 18.0;
  static const inline = 20.0;
  static const standard = 24.0;
  static const navigation = 26.0;
  static const emptyState = 48.0;
  static const touchTarget = 48.0;
}

abstract final class HandsButtonTheme {
  static const height = 56.0;
  static const compactHeight = 44.0;
  static const pressDuration = Duration(milliseconds: 120);
}

abstract final class HandsTypography {
  static const sansFamily = 'Inter';
  static const displayFamily = 'Newsreader';
  static const numericFamily = 'Inter';
  static const sansFallback = <String>[
    'Pretendard',
    'Noto Sans JP',
    'Noto Sans SC',
    'Noto Sans TC',
    'Roboto',
  ];
  static const displayFallback = <String>[
    'Noto Serif KR',
    'Noto Serif JP',
    'Noto Serif SC',
    'Noto Serif TC',
    'serif',
  ];

  static TextStyle numeric(TextStyle? base) =>
      (base ?? const TextStyle()).copyWith(
        fontFamily: numericFamily,
        fontFamilyFallback: sansFallback,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextTheme textTheme(HandsColors colors) {
    TextStyle sans({
      required double size,
      required double height,
      FontWeight weight = FontWeight.w400,
    }) =>
        TextStyle(
          color: colors.ink,
          fontFamily: sansFamily,
          fontFamilyFallback: sansFallback,
          fontSize: size,
          height: height / size,
          fontWeight: weight,
          letterSpacing: 0,
        );

    TextStyle display({
      required double size,
      required double height,
    }) =>
        TextStyle(
          color: colors.ink,
          fontFamily: displayFamily,
          fontFamilyFallback: displayFallback,
          fontSize: size,
          height: height / size,
          fontWeight: FontWeight.w500,
          letterSpacing: 0,
        );

    return TextTheme(
      displayLarge: display(size: 44, height: 48),
      displayMedium: display(size: 36, height: 40),
      displaySmall: display(size: 30, height: 36),
      headlineLarge: display(size: 30, height: 36),
      headlineMedium: display(size: 26, height: 32),
      headlineSmall: sans(size: 22, height: 28, weight: FontWeight.w600),
      titleLarge: sans(size: 20, height: 26, weight: FontWeight.w600),
      titleMedium: sans(size: 18, height: 24, weight: FontWeight.w600),
      titleSmall: sans(size: 15, height: 20, weight: FontWeight.w600),
      bodyLarge: sans(size: 16, height: 26),
      bodyMedium: sans(size: 14, height: 22),
      bodySmall: sans(size: 12, height: 16, weight: FontWeight.w500)
          .copyWith(color: colors.inkMuted),
      labelLarge: sans(size: 15, height: 20, weight: FontWeight.w600),
      labelMedium: sans(size: 13, height: 18, weight: FontWeight.w500),
      labelSmall: sans(size: 12, height: 16, weight: FontWeight.w500),
    );
  }
}

abstract final class ProviderSpacing {
  static const page = HandsSpacing.space20;
  static const section = HandsSpacing.space32;
  static const item = HandsSpacing.space12;
  static const compact = HandsSpacing.space8;
}

abstract final class ProviderRadii {
  static const card = HandsShapes.large;
  static const control = HandsShapes.medium;
  static const sheet = HandsShapes.sheet;
}

ThemeData buildProviderTheme({Brightness brightness = Brightness.light}) {
  final colors =
      brightness == Brightness.dark ? HandsColors.dark : HandsColors.light;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    primaryContainer: colors.primarySoft,
    onPrimaryContainer: colors.ink,
    secondary: colors.mistBlue,
    onSecondary: colors.ink,
    secondaryContainer: colors.sand,
    onSecondaryContainer: colors.ink,
    tertiary: colors.warning,
    onTertiary: colors.onPrimary,
    tertiaryContainer: colors.sand,
    onTertiaryContainer: colors.ink,
    error: colors.error,
    onError: colors.onPrimary,
    errorContainer: brightness == Brightness.dark
        ? const Color(0xFF552D29)
        : const Color(0xFFF3E1DE),
    onErrorContainer: colors.ink,
    surface: colors.surface,
    onSurface: colors.ink,
    surfaceContainerHighest: colors.surfaceMuted,
    onSurfaceVariant: colors.inkMuted,
    outline: colors.outline,
    outlineVariant: colors.outline,
    shadow: Colors.transparent,
    scrim: const Color(0x99000000),
    inverseSurface: colors.ink,
    onInverseSurface: colors.surface,
    inversePrimary: colors.primarySoft,
  );
  final textTheme = HandsTypography.textTheme(colors);

  final base = ThemeData(
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: colors.canvas,
    canvasColor: colors.canvas,
    fontFamily: HandsTypography.sansFamily,
    fontFamilyFallback: HandsTypography.sansFallback,
    textTheme: textTheme,
    useMaterial3: true,
    extensions: [colors],
  );

  final controlShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(HandsShapes.medium),
  );

  return base.copyWith(
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      foregroundColor: colors.ink,
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      toolbarHeight: 64,
      iconTheme:
          IconThemeData(color: colors.ink, size: HandsIconTheme.standard),
      titleTextStyle: textTheme.titleLarge,
    ),
    iconTheme: IconThemeData(
      color: colors.ink,
      size: HandsIconTheme.standard,
      weight: 400,
      grade: 0,
      opticalSize: HandsIconTheme.standard,
    ),
    cardTheme: CardThemeData(
      color: colors.surface,
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(HandsShapes.large),
        side: BorderSide(color: colors.outline),
      ),
    ),
    dividerTheme: DividerThemeData(
      color: colors.outline,
      thickness: 1,
      space: 1,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colors.surfaceMuted,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: HandsSpacing.space16,
        vertical: HandsSpacing.space16,
      ),
      labelStyle: textTheme.labelMedium?.copyWith(color: colors.inkMuted),
      helperStyle: textTheme.labelMedium?.copyWith(color: colors.inkMuted),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HandsShapes.medium),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HandsShapes.medium),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HandsShapes.medium),
        borderSide: BorderSide(color: colors.primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HandsShapes.medium),
        borderSide: BorderSide(color: colors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HandsShapes.medium),
        borderSide: BorderSide(color: colors.error, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: colors.primary,
        foregroundColor: colors.onPrimary,
        disabledBackgroundColor: colors.surfaceMuted,
        disabledForegroundColor: colors.inkMuted,
        elevation: 0,
        shadowColor: Colors.transparent,
        minimumSize: const Size(48, HandsButtonTheme.height),
        padding: const EdgeInsets.symmetric(horizontal: HandsSpacing.space20),
        shape: controlShape,
        textStyle: textTheme.labelLarge,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        backgroundColor: colors.surface,
        foregroundColor: colors.ink,
        elevation: 0,
        shadowColor: Colors.transparent,
        minimumSize: const Size(48, HandsButtonTheme.height),
        padding: const EdgeInsets.symmetric(horizontal: HandsSpacing.space20),
        side: BorderSide(color: colors.outline),
        shape: controlShape,
        textStyle: textTheme.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: colors.primary,
        minimumSize: const Size(48, 48),
        textStyle: textTheme.labelLarge,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: colors.ink,
        disabledForegroundColor: colors.inkMuted,
        minimumSize: const Size.square(HandsIconTheme.touchTarget),
        maximumSize: const Size.square(HandsIconTheme.touchTarget),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(HandsShapes.small),
        ),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 72,
      elevation: 0,
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      backgroundColor: colors.surface,
      indicatorColor: colors.primarySoft,
      indicatorShape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(HandsShapes.full),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? colors.primary
              : colors.inkMuted,
          size: HandsIconTheme.navigation,
          fill: states.contains(WidgetState.selected) ? 1 : 0,
          weight: states.contains(WidgetState.selected) ? 500 : 400,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => textTheme.labelSmall?.copyWith(
          color: states.contains(WidgetState.selected)
              ? colors.primary
              : colors.inkMuted,
        ),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: colors.surface,
      modalBackgroundColor: colors.surface,
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      modalElevation: 0,
      modalBarrierColor: const Color(0x99000000),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(HandsShapes.sheet),
        ),
      ),
      showDragHandle: false,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: colors.surface,
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(HandsShapes.large),
      ),
      titleTextStyle: textTheme.titleLarge,
      contentTextStyle: textTheme.bodyLarge,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: colors.ink,
      contentTextStyle: textTheme.bodyMedium?.copyWith(color: colors.surface),
      elevation: 0,
      behavior: SnackBarBehavior.floating,
      shape: controlShape,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: colors.primary,
      linearTrackColor: colors.primarySoft,
      circularTrackColor: colors.primarySoft,
    ),
  );
}
