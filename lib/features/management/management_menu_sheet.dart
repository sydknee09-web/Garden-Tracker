import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../core/constants/app_colors.dart';
import '../../core/content/elias_dialogue.dart';
import '../../providers/satchel_provider.dart';
import '../../providers/elias_provider.dart';

class ManagementMenuSheet extends ConsumerWidget {
  const ManagementMenuSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewportHeight = MediaQuery.sizeOf(context).height;
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxHeight = (viewportHeight * 0.6).clamp(0.0, constraints.maxHeight);
        return Container(
          constraints: BoxConstraints(maxHeight: maxHeight),
          padding: EdgeInsets.fromLTRB(
            24, 12, 24, MediaQuery.of(context).padding.bottom + 24,
          ),
          decoration: BoxDecoration(
            color: AppColors.charcoal,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            border: const Border(
              top: BorderSide(color: AppColors.slotBorder, width: 0.5),
            ),
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 24),
            decoration: BoxDecoration(
              color: AppColors.ashGrey,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          _MenuItem(
            icon: Icons.shopping_bag_outlined,
            label: 'Pack Satchel',
            onTap: () async {
              Navigator.of(context).pop();
              final message =
                  await ref.read(satchelProvider.notifier).packSatchel();
              // Elias reacts after packing.
              ref.read(eliasMessageProvider.notifier).state =
                  EliasDialogue.afterPack();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      message,
                      style: const TextStyle(
                        fontFamily: 'Georgia',
                        color: AppColors.parchment,
                      ),
                    ),
                    backgroundColor: AppColors.charcoal,
                    behavior: SnackBarBehavior.floating,
                    duration: const Duration(seconds: 2),
                  ),
                );
              }
            },
          ),

          _MenuItem(
            icon: Icons.inventory_2_outlined,
            label: 'Archive Recovery',
            onTap: () {
              Navigator.of(context).pop();
              context.push(AppRoutes.archive);
            },
          ),

          _MenuItem(
            icon: Icons.settings_outlined,
            label: 'Settings',
            onTap: () {
              Navigator.of(context).pop();
              context.push(AppRoutes.settings);
            },
          ),
        ],
        ),
      ),
    );
      },
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.parchment),
            const SizedBox(width: 16),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: AppColors.parchment,
                    letterSpacing: 0.5,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
