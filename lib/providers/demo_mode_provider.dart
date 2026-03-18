import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/demo_mode.dart';

/// Canonical source for demo mode. Repository providers watch this.
/// When toggled in settings, repositories hot-swap without app restart.
/// Initial value from [isDemoMode] (loaded at bootstrap).
final demoModeProvider = StateProvider<bool>((ref) => isDemoMode);
