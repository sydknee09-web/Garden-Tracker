import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/config/demo_mode.dart';
import '../data/supabase_service.dart';

/// Fake user for demo/offline mode. Supabase is never initialized in demo mode.
User get _demoUser => User(
      id: 'demo-user-id',
      appMetadata: {},
      userMetadata: {},
      aud: 'authenticated',
      createdAt: DateTime.now().toIso8601String(),
    );

/// Emits the current Supabase [User] or null if not authenticated.
/// In demo mode, emits a fake user so the app runs without Supabase.
final authProvider = StreamProvider<User?>((ref) {
  if (isDemoMode) {
    return Stream.value(_demoUser);
  }
  return SupabaseService.client.auth.onAuthStateChange
      .map((event) => event.session?.user);
});

/// Convenience: true if a user is logged in.
final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).valueOrNull != null;
});

/// The current user's ID. Null if not authenticated.
final currentUserIdProvider = Provider<String?>((ref) {
  return ref.watch(authProvider).valueOrNull?.id;
});
