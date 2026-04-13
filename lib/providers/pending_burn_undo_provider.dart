import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Shown on Sanctuary after a hearth burn; SnackBar offers undo (swipe away or close icon to dismiss).
class BurnUndoToken {
  const BurnUndoToken({
    required this.nodeId,
    required this.slotId,
    required this.mountainId,
    required this.title,
  });

  final String nodeId;
  final String slotId;
  final String mountainId;
  final String title;
}

final pendingBurnUndoProvider = StateProvider<BurnUndoToken?>((ref) => null);
