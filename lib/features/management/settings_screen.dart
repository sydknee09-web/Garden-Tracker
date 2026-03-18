import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../app.dart';
import '../../core/constants/app_colors.dart';
import '../../data/supabase_cache.dart';
import '../../data/supabase_service.dart';
import '../../providers/auth_provider.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/node_provider.dart';
import '../../providers/sound_settings_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(authProvider);
    final email = userAsync.valueOrNull?.email ?? '—';

    return Scaffold(
      backgroundColor: AppColors.inkBlack,
      appBar: AppBar(
        backgroundColor: AppColors.inkBlack,
        elevation: 0,
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sanctuary ›',
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 10,
                letterSpacing: 1,
                color: AppColors.ashGrey,
              ),
            ),
            const Text(
              'SETTINGS',
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 14,
                letterSpacing: 3,
                color: AppColors.parchment,
              ),
            ),
          ],
        ),
        iconTheme: const IconThemeData(color: AppColors.parchment),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
        children: [
          const SizedBox(height: 16),

          // ── Account section ────────────────────────────────
          _SectionHeader(label: 'ACCOUNT'),
          const SizedBox(height: 12),

          _InfoRow(
            icon: Icons.person_outline,
            label: 'Signed in as',
            value: email,
          ),

          const SizedBox(height: 12),
          _ActionRow(
            icon: Icons.lock_reset,
            label: 'Reset Password',
            color: AppColors.parchment,
            onTap: () => _requestPasswordReset(context, email),
          ),
          const SizedBox(height: 8),
          _ActionRow(
            icon: Icons.person_remove_outlined,
            label: 'Delete Profile',
            color: AppColors.ember,
            onTap: () => _confirmDeleteProfile(context, ref),
          ),

          const SizedBox(height: 8),

          _Divider(),

          const SizedBox(height: 24),

          _SectionHeader(label: 'SOUND'),
          const SizedBox(height: 12),

          _SoundToggleRow(),

          const SizedBox(height: 24),

          _Divider(),

          const SizedBox(height: 24),

          _SectionHeader(label: 'LEGAL'),
          const SizedBox(height: 12),

          _ActionRow(
            icon: Icons.article_outlined,
            label: 'Credits',
            color: AppColors.parchment,
            onTap: () => context.push(AppRoutes.credits),
          ),

          const SizedBox(height: 24),

          _SectionHeader(label: 'SESSION'),
          const SizedBox(height: 12),

          _ActionRow(
            icon: Icons.logout,
            label: 'Sign Out',
            color: AppColors.ember,
            onTap: () => _confirmSignOut(context, ref),
          ),
        ],
      ),
    );
  }

  void _requestPasswordReset(BuildContext context, String email) {
    if (email.isEmpty || email == '—' || !email.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No email on file. Sign in again to reset password.'),
          backgroundColor: AppColors.charcoal,
        ),
      );
      return;
    }
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.charcoal,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.slotBorder, width: 0.5),
        ),
        title: const Text(
          'Reset Password',
          style: TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
            fontSize: 16,
          ),
        ),
        content: Text(
          'Send a password reset link to $email?',
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.ashGrey,
            fontSize: 13,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.ashGrey, fontFamily: 'Georgia'),
            ),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              try {
                await SupabaseService.client.auth.resetPasswordForEmail(
                  email,
                  redirectTo: 'voyagersanctuary://reset-password',
                );
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: const Text(
                        'Check your email for the reset link.',
                        style: TextStyle(
                          fontFamily: 'Georgia',
                          color: AppColors.parchment,
                        ),
                      ),
                      backgroundColor: AppColors.charcoal,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              } on AuthException catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(e.message),
                      backgroundColor: AppColors.charcoal,
                    ),
                  );
                }
              }
            },
            child: const Text(
              'Send Link',
              style: TextStyle(
                color: AppColors.ember,
                fontFamily: 'Georgia',
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteProfile(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.charcoal,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.slotBorder, width: 0.5),
        ),
        title: const Text(
          'Delete Profile',
          style: TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
            fontSize: 16,
          ),
        ),
        content: const Text(
          'This will permanently delete your account and all your data. This cannot be undone.',
          style: TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.ashGrey,
            fontSize: 13,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.ashGrey, fontFamily: 'Georgia'),
            ),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              try {
                await SupabaseService.client.rpc('delete_user_account');
                final userId = SupabaseService.currentUser?.id;
                await SupabaseService.client.auth.signOut();
                ref.invalidate(mountainListProvider);
                ref.invalidate(archivedMountainListProvider);
                ref.invalidate(nodeListProvider);
                if (userId != null) {
                  await SupabaseCache.instance.clearForUser(userId);
                }
                if (context.mounted) context.go('/');
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        'Account deletion is not configured. Contact support.',
                      ),
                      backgroundColor: AppColors.charcoal,
                    ),
                  );
                }
              }
            },
            child: const Text(
              'Delete',
              style: TextStyle(
                color: AppColors.ember,
                fontFamily: 'Georgia',
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _confirmSignOut(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.charcoal,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.slotBorder, width: 0.5),
        ),
        title: const Text(
          'Leave the Sanctuary?',
          style: TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
            fontSize: 16,
          ),
        ),
        content: const Text(
          'Your progress is saved. You can return whenever you\'re ready.',
          style: TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.ashGrey,
            fontSize: 13,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(
              'Stay',
              style: TextStyle(
                color: AppColors.ashGrey,
                fontFamily: 'Georgia',
              ),
            ),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final userId = SupabaseService.currentUser?.id;
              await SupabaseService.client.auth.signOut();
              ref.invalidate(mountainListProvider);
              ref.invalidate(archivedMountainListProvider);
              ref.invalidate(nodeListProvider);
              if (userId != null) {
                await SupabaseCache.instance.clearForUser(userId);
              }
              if (context.mounted) context.go('/');
            },
            child: const Text(
              'Sign Out',
              style: TextStyle(
                color: AppColors.ember,
                fontFamily: 'Georgia',
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Helper widgets ────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(
        fontFamily: 'Georgia',
        fontSize: 9,
        letterSpacing: 2.5,
        color: AppColors.ashGrey,
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.ashGrey),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 11,
                  color: AppColors.ashGrey,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 13,
                  color: AppColors.parchment,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = AppColors.parchment,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 14),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 14,
                color: color,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SoundToggleRow extends ConsumerWidget {
  const _SoundToggleRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final soundOn = ref.watch(soundEnabledProvider);
    return InkWell(
      onTap: () {
        HapticFeedback.lightImpact();
        ref.read(soundEnabledProvider.notifier).setEnabled(!soundOn);
      },
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
        child: Row(
          children: [
            Icon(
              soundOn ? Icons.volume_up_outlined : Icons.volume_off_outlined,
              size: 20,
              color: AppColors.parchment,
            ),
            const SizedBox(width: 14),
            Text(
              'Sound effects',
              style: const TextStyle(
                fontFamily: 'Georgia',
                fontSize: 14,
                color: AppColors.parchment,
                letterSpacing: 0.3,
              ),
            ),
            const Spacer(),
            Switch(
              value: soundOn,
              onChanged: (v) {
                HapticFeedback.lightImpact();
                ref.read(soundEnabledProvider.notifier).setEnabled(v);
              },
              activeThumbColor: AppColors.parchment,
              activeTrackColor: AppColors.ember.withValues(alpha: 0.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 0.5,
      color: AppColors.slotBorder,
    );
  }
}
