import '../models/profile.dart';
import '../repositories/profile_repository.dart';
import 'demo_storage.dart';

/// In-memory profile for demo mode. Flip hasSeenEliasIntro when intro completes
/// so demo users don't loop on hot-restart.
class DemoProfileRepository implements ProfileRepositoryInterface {
  DemoProfileRepository._();
  static final DemoProfileRepository _instance = DemoProfileRepository._();
  static DemoProfileRepository get instance => _instance;

  Profile _profile = Profile(
    id: DemoStorage.demoUserId,
    hasSeenEliasIntro: false,
    displayName: null,
  );

  Profile get profile => _profile;

  @override
  Future<void> ensureProfile() async {
    // No-op; profile always exists in demo
  }

  @override
  Future<Profile?> fetchProfile() async => _profile;

  @override
  Future<Profile?> ensureAndFetchProfile() async => _profile;

  @override
  Future<void> setHasSeenEliasIntro() async {
    _profile = _profile.copyWith(hasSeenEliasIntro: true);
  }

  @override
  Future<void> updateDisplayName(String name) async {
    _profile = _profile.copyWith(displayName: name);
  }

  /// Reset for first-user flow. Call before entering app to force intro sequence.
  void resetForFirstUser() {
    _profile = Profile(
      id: DemoStorage.demoUserId,
      hasSeenEliasIntro: false,
      displayName: null,
    );
  }
}
