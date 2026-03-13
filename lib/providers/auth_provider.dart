import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../data/supabase_service.dart';

/// Emits the current Supabase [User] or null if not authenticated.
/// Drives go_router auth guards — every protected route reads this.
final authProvider = StreamProvider<User?>((ref) {
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
