import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/app_colors.dart';
import '../../data/supabase_service.dart';

// ─────────────────────────────────────────────────────────────
// AUTH SCREEN — login / sign-up gate
// ─────────────────────────────────────────────────────────────

enum _AuthMode { signIn, signUp }

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  _AuthMode _mode = _AuthMode.signIn;
  bool _loading = false;

  final _emailController    = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey             = GlobalKey<FormState>();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  // ── Actions ───────────────────────────────────────────────

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _loading = true);

    try {
      if (_mode == _AuthMode.signIn) {
        await SupabaseService.client.auth.signInWithPassword(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
      } else {
        final res = await SupabaseService.client.auth.signUp(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
        if (mounted && res.session == null) {
          _showSuccess(
            'Check your email — we\'ve sent a verification link.',
          );
        }
      }
      // go_router redirect fires automatically on auth state change
    } on AuthException catch (e) {
      if (mounted) _showError(_friendlyAuthMessage(e.message));
    } catch (e) {
      if (mounted) _showError(_friendlyAuthMessage(e.toString()));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _requestPasswordReset() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      _showError('Enter your email above, then tap Forgot password.');
      return;
    }
    setState(() => _loading = true);
    try {
      await SupabaseService.client.auth.resetPasswordForEmail(
        email,
        redirectTo: 'voyagersanctuary://',
      );
      if (mounted) {
        _showSuccess(
          'Check your email for a reset link. Use it soon — the link expires.',
        );
      }
    } on AuthException catch (e) {
      if (mounted) _showError(_friendlyAuthMessage(e.message));
    } catch (e) {
      if (mounted) _showError(_friendlyAuthMessage(e.toString()));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Maps raw auth/network errors to user-friendly messages.
  static String _friendlyAuthMessage(String raw) {
    final lower = raw.toLowerCase();
    // Network / connectivity
    if (lower.contains('host lookup') ||
        lower.contains('socketexception') ||
        lower.contains('no address associated') ||
        lower.contains('connection refused') ||
        lower.contains('connection timed out') ||
        lower.contains('network is unreachable')) {
      return 'Can\'t reach the server. Check your internet connection and try again.';
    }
    // Invalid email or password
    if (lower.contains('invalid login credentials') ||
        lower.contains('invalid_credentials') ||
        lower.contains('invalid email or password')) {
      return 'Email or password incorrect. Please try again.';
    }
    // Email not confirmed
    if (lower.contains('email not confirmed') ||
        lower.contains('signup_not_confirmed')) {
      return 'Please check your email and confirm your account, then try again.';
    }
    // User already registered (sign-up)
    if (lower.contains('already registered') ||
        lower.contains('user already registered')) {
      return 'An account with this email already exists. Sign in instead.';
    }
    // Generic fallback
    return 'Sign-in failed. Please try again.';
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
            fontSize: 13,
          ),
        ),
        backgroundColor: AppColors.charcoal,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: AppColors.ember, width: 0.5),
        ),
      ),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
            fontSize: 13,
          ),
        ),
        backgroundColor: AppColors.charcoal,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: AppColors.gold, width: 0.5),
        ),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Night gradient background (auth is always night — the gate before dawn)
          const _AuthBackground(),

          // Decorative top crest
          Positioned(
            top: 0, left: 0, right: 0,
            child: _TopCrest(),
          ),

          // Main form card
          Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                24, MediaQuery.of(context).padding.top + 60,
                24, MediaQuery.of(context).padding.bottom + 24,
              ),
              child: _FormCard(
                mode: _mode,
                loading: _loading,
                emailController: _emailController,
                passwordController: _passwordController,
                formKey: _formKey,
                onSubmit: _submit,
                onForgotPassword: _requestPasswordReset,
                onToggleMode: () => setState(() {
                  _mode = _mode == _AuthMode.signIn
                      ? _AuthMode.signUp
                      : _AuthMode.signIn;
                  _formKey.currentState?.reset();
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// BACKGROUND
// ─────────────────────────────────────────────────────────────

class _AuthBackground extends StatelessWidget {
  const _AuthBackground();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: AppColors.nightGradient,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// TOP CREST
// ─────────────────────────────────────────────────────────────

class _TopCrest extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(32, MediaQuery.of(context).padding.top + 40, 32, 0),
      child: Column(
        children: [
          // Decorative divider line
          Row(
            children: [
              Expanded(
                child: Container(height: 0.5, color: AppColors.gold.withValues(alpha: 0.4)),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.gold,
                  ),
                ),
              ),
              Expanded(
                child: Container(height: 0.5, color: AppColors.gold.withValues(alpha: 0.4)),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // App title
          const Text(
            'VOYAGER',
            style: TextStyle(
              fontFamily: 'Georgia',
              fontSize: 32,
              fontWeight: FontWeight.w400,
              letterSpacing: 10,
              color: AppColors.parchment,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'S A N C T U A R Y',
            style: TextStyle(
              fontFamily: 'Georgia',
              fontSize: 11,
              letterSpacing: 8,
              color: AppColors.gold,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: Container(height: 0.5, color: AppColors.gold.withValues(alpha: 0.4)),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.gold,
                  ),
                ),
              ),
              Expanded(
                child: Container(height: 0.5, color: AppColors.gold.withValues(alpha: 0.4)),
              ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 600.ms)
        .slideY(begin: -0.04, end: 0, duration: 600.ms);
  }
}

// ─────────────────────────────────────────────────────────────
// FORM CARD
// ─────────────────────────────────────────────────────────────

class _FormCard extends StatelessWidget {
  const _FormCard({
    required this.mode,
    required this.loading,
    required this.emailController,
    required this.passwordController,
    required this.formKey,
    required this.onSubmit,
    required this.onForgotPassword,
    required this.onToggleMode,
  });

  final _AuthMode mode;
  final bool loading;
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final GlobalKey<FormState> formKey;
  final VoidCallback onSubmit;
  final VoidCallback onForgotPassword;
  final VoidCallback onToggleMode;

  @override
  Widget build(BuildContext context) {
    final isSignIn = mode == _AuthMode.signIn;

    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: AppColors.charcoal.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.gold.withValues(alpha: 0.25),
          width: 0.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.5),
            blurRadius: 40,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Mode toggle
            _ModeToggle(mode: mode, onToggle: onToggleMode),
            const SizedBox(height: 28),

            // Email field
            _AuthField(
              controller: emailController,
              label: 'EMAIL',
              keyboardType: TextInputType.emailAddress,
              autofillHint: isSignIn
                  ? AutofillHints.username
                  : AutofillHints.newUsername,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Required';
                if (!v.contains('@')) return 'Enter a valid email';
                return null;
              },
            ),
            const SizedBox(height: 20),

            // Password field
            _AuthField(
              controller: passwordController,
              label: 'PASSWORD',
              obscure: true,
              autofillHint: isSignIn
                  ? AutofillHints.password
                  : AutofillHints.newPassword,
              validator: (v) {
                if (v == null || v.isEmpty) return 'Required';
                if (!isSignIn && v.length < 8) {
                  return 'Minimum 8 characters';
                }
                return null;
              },
              onSubmit: (_) => onSubmit(),
            ),

            if (isSignIn) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: GestureDetector(
                  onTap: loading ? null : onForgotPassword,
                  child: Text(
                    'Forgot password?',
                    style: TextStyle(
                      fontFamily: 'Georgia',
                      fontSize: 12,
                      color: loading ? AppColors.ashGrey : AppColors.gold,
                      fontStyle: FontStyle.italic,
                      decoration: TextDecoration.underline,
                      decorationColor: loading ? AppColors.ashGrey : AppColors.gold,
                    ),
                  ),
                ),
              ),
            ],

            if (!isSignIn) ...[
              const SizedBox(height: 12),
              const Text(
                'Use a strong password of at least 8 characters.',
                style: TextStyle(
                  color: AppColors.ashGrey,
                  fontFamily: 'Georgia',
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],

            const SizedBox(height: 32),

            // Primary action button
            _SubmitButton(
              label: isSignIn ? 'Enter the Sanctuary' : 'Begin the Ascent',
              loading: loading,
              onTap: onSubmit,
            ),

            const SizedBox(height: 20),

            // Divider
            Row(
              children: [
                Expanded(
                  child: Container(
                    height: 0.5,
                    color: AppColors.slotBorder,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Toggle link
            GestureDetector(
              onTap: onToggleMode,
              child: Text(
                isSignIn
                    ? 'No account yet? Create one.'
                    : 'Already have an account? Sign in.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 12,
                  color: AppColors.ashGrey,
                  fontStyle: FontStyle.italic,
                  decoration: TextDecoration.underline,
                  decorationColor: AppColors.ashGrey,
                ),
              ),
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(duration: 500.ms, delay: 200.ms)
        .slideY(begin: 0.06, end: 0, duration: 500.ms, delay: 200.ms);
  }
}

// ─────────────────────────────────────────────────────────────
// MODE TOGGLE
// ─────────────────────────────────────────────────────────────

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({required this.mode, required this.onToggle});
  final _AuthMode mode;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.inkBlack,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.slotBorder, width: 0.5),
      ),
      child: Row(
        children: _AuthMode.values.map((m) {
          final selected = m == mode;
          return Expanded(
            child: GestureDetector(
              onTap: selected ? null : onToggle,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: selected ? AppColors.ember : Colors.transparent,
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Text(
                  m == _AuthMode.signIn ? 'SIGN IN' : 'CREATE ACCOUNT',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: 11,
                    letterSpacing: 1.5,
                    color: selected ? AppColors.parchment : AppColors.ashGrey,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// AUTH TEXT FIELD
// ─────────────────────────────────────────────────────────────

class _AuthField extends StatelessWidget {
  const _AuthField({
    required this.controller,
    required this.label,
    this.keyboardType = TextInputType.text,
    this.obscure = false,
    this.autofillHint,
    this.validator,
    this.onSubmit,
  });

  final TextEditingController controller;
  final String label;
  final TextInputType keyboardType;
  final bool obscure;
  final String? autofillHint;
  final String? Function(String?)? validator;
  final void Function(String)? onSubmit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 9,
            letterSpacing: 2.5,
            color: AppColors.ashGrey,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscure,
          autofillHints: autofillHint != null ? [autofillHint!] : null,
          onFieldSubmitted: onSubmit,
          validator: validator,
          style: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 14,
            color: AppColors.parchment,
            letterSpacing: 0.3,
          ),
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(vertical: 8),
            border: InputBorder.none,
            enabledBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.slotBorder, width: 0.5),
            ),
            focusedBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.gold, width: 1),
            ),
            errorBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.ember, width: 1),
            ),
            focusedErrorBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.ember, width: 1),
            ),
            errorStyle: const TextStyle(
              fontFamily: 'Georgia',
              fontSize: 10,
              color: AppColors.ember,
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SUBMIT BUTTON
// ─────────────────────────────────────────────────────────────

class _SubmitButton extends StatelessWidget {
  const _SubmitButton({
    required this.label,
    required this.loading,
    required this.onTap,
  });

  final String label;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height: 50,
        decoration: BoxDecoration(
          color: loading
              ? AppColors.ember.withValues(alpha: 0.5)
              : AppColors.ember,
          borderRadius: BorderRadius.circular(6),
          boxShadow: loading
              ? null
              : [
                  BoxShadow(
                    color: AppColors.ember.withValues(alpha: 0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
        ),
        child: Center(
          child: loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    color: AppColors.parchment,
                    strokeWidth: 1.5,
                  ),
                )
              : Text(
                  label,
                  style: const TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: 13,
                    letterSpacing: 2,
                    color: AppColors.parchment,
                  ),
                ),
        ),
      ),
    );
  }
}
