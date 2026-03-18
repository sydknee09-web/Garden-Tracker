import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';

import 'bootstrap.dart';
import 'firebase_options.dart';
import 'widgets/sanctuary_error_widget.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  ErrorWidget.builder = (FlutterErrorDetails details) {
    return SanctuaryErrorWidget(
      message: 'The app hit an unexpected error.',
      details: details.exceptionAsString(),
      onRetry: restartVoyagerSanctuary,
    );
  };
  runVoyagerSanctuary();
}
