import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/app_colors.dart';

/// Credits and audio/asset attributions (e.g. CC-licensed sounds).
class CreditsView extends StatelessWidget {
  const CreditsView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.inkBlack,
      appBar: AppBar(
        backgroundColor: AppColors.inkBlack,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.parchment),
          onPressed: () => context.pop(),
        ),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Settings ›',
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 10,
                letterSpacing: 1,
                color: AppColors.ashGrey,
              ),
            ),
            const Text(
              'CREDITS',
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
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        children: [
          const SizedBox(height: 8),
          _SectionHeader(label: 'AUDIO'),
          const SizedBox(height: 12),
          _CreditEntry(
            title: 'Luffy Fire2 (app open / parchment snap)',
            author: 'Luffy',
            url: 'https://freesound.org/people/Luffy/sounds/17294/',
            license: 'CC BY 3.0',
          ),
          _CreditEntry(
            title: 'Unrolling Map',
            author: 'Benboncan',
            url: 'https://freesound.org/people/Benboncan/sounds/77319/',
            license: 'CC BY 4.0',
          ),
          _CreditEntry(
            title: 'Rolling Rocks 06 (rock break)',
            author: 'Uminari',
            url: 'https://freesound.org/people/Uminari/sounds/389724/',
            license: 'CC BY 3.0',
          ),
          _CreditEntry(
            title: '20100422lightmyfire (stone drop / hearth thud)',
            author: 'dobroide',
            url: 'https://freesound.org/people/dobroide/sounds/95550/',
            license: 'CC BY 3.0',
          ),
          _CreditEntry(
            title: 'flame-ignition (hearth weight layer)',
            author: 'hykenfreak',
            url: 'https://freesound.org/people/hykenfreak/sounds/331621/',
            license: 'CC BY 3.0',
          ),
        ],
      ),
    );
  }
}

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

class _CreditEntry extends StatelessWidget {
  const _CreditEntry({
    required this.title,
    required this.author,
    required this.url,
    required this.license,
  });

  final String title;
  final String author;
  final String url;
  final String license;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '"$title" by $author',
            style: const TextStyle(
              fontFamily: 'Georgia',
              fontSize: 14,
              color: AppColors.parchment,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 4),
          SelectableText(
            url,
            style: TextStyle(
              fontFamily: 'Georgia',
              fontSize: 12,
              color: AppColors.ember,
              decoration: TextDecoration.underline,
              letterSpacing: 0.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Licensed under $license',
            style: const TextStyle(
              fontFamily: 'Georgia',
              fontSize: 11,
              color: AppColors.ashGrey,
            ),
          ),
        ],
      ),
    );
  }
}
