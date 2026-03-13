import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/mountain_provider.dart';

class ArchiveScreen extends ConsumerWidget {
  const ArchiveScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final archivedAsync = ref.watch(archivedMountainListProvider);

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
              'ARCHIVE',
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
      body: archivedAsync.when(
        data: (mountains) {
          if (mountains.isEmpty) {
            return const Center(
              child: Text(
                'No archived mountains.',
                style: TextStyle(
                  color: AppColors.ashGrey,
                  fontFamily: 'Georgia',
                  fontStyle: FontStyle.italic,
                ),
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: mountains.length,
            itemBuilder: (context, i) {
              final mountain = mountains[i];
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16, vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: AppColors.charcoal,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppColors.slotBorder, width: 0.5,
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.landscape_outlined,
                      color: AppColors.ashGrey,
                      size: 18,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        mountain.name,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    ),
                    TextButton(
                      onPressed: () async {
                        try {
                          await ref
                              .read(mountainActionsProvider)
                              .restore(mountain.id);
                          ref.invalidate(mountainListProvider);
                          ref.invalidate(archivedMountainListProvider);
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  e.toString(),
                                  style: const TextStyle(
                                    fontFamily: 'Georgia',
                                    color: AppColors.parchment,
                                  ),
                                ),
                                backgroundColor: AppColors.charcoal,
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        }
                      },
                      child: const Text(
                        'Restore',
                        style: TextStyle(
                          color: AppColors.ember,
                          fontFamily: 'Georgia',
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.ember),
        ),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  "Can't load archive. Check your connection.",
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.ashGrey,
                    fontFamily: 'Georgia',
                    fontStyle: FontStyle.italic,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => ref.invalidate(archivedMountainListProvider),
                  child: const Text(
                    'Retry',
                    style: TextStyle(
                      color: AppColors.ember,
                      fontFamily: 'Georgia',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
