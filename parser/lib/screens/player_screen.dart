import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key, required this.url, this.title = ''});
  final String url;
  final String title;

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  VideoPlayerController? _c;
  String? error;
  bool started = false;

  bool get isHls =>
      RegExp(r'\.m3u8(\?|#|$)', caseSensitive: false).hasMatch(widget.url);

  Future<void> _init() async {
    if (started) return;
    started = true;
    try {
      final c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
      await c.initialize();
      await c.play();
      if (!mounted) { c.dispose(); return; }
      setState(() => _c = c);
    } catch (e) {
      if (mounted) setState(() => error = 'Плеер не смог открыть этот формат');
    }
  }

  @override
  void initState() {
    super.initState();
    if (!isHls) _init();
  }

  @override
  void dispose() {
    _c?.dispose();
    super.dispose();
  }

  String _fmt(Duration d) {
    final h = d.inHours, m = d.inMinutes.remainder(60), s = d.inSeconds.remainder(60);
    return h > 0
        ? '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}'
        : '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final ink = Theme.of(context).colorScheme.onSurface;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(widget.title, style: const TextStyle(fontSize: 14)),
      ),
      body: Center(
        child: isHls || error != null ? _fallback(ink) : _player(),
      ),
    );
  }

  Widget _player() {
    final c = _c;
    if (c == null || !c.value.isInitialized) {
      return const Column(mainAxisSize: MainAxisSize.min, children: [
        CircularProgressIndicator(),
        SizedBox(height: 12),
        Text('Гружу видео…', style: TextStyle(color: Colors.white54)),
      ]);
    }
    return AspectRatio(
      aspectRatio: c.value.aspectRatio == 0 ? 16 / 9 : c.value.aspectRatio,
      child: Stack(alignment: Alignment.bottomCenter, children: [
        VideoPlayer(c),
        VideoProgressIndicator(c, allowScrubbing: true, padding: const EdgeInsets.all(8)),
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() {
              c.value.isPlaying ? c.pause() : c.play();
            }),
            child: Center(
              child: AnimatedOpacity(
                opacity: c.value.isPlaying ? 0 : 1,
                duration: const Duration(milliseconds: 200),
                child: Container(
                  width: 72, height: 72,
                  decoration: const BoxDecoration(color: Colors.black45, shape: BoxShape.circle),
                  child: const Icon(Icons.play_arrow, size: 44, color: Colors.white),
                ),
              ),
            ),
          ),
        ),
        Positioned(
          right: 12, top: 12,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            color: Colors.black45,
            child: Text(
              '${_fmt(c.value.position)} / ${_fmt(c.value.duration)}',
              style: const TextStyle(color: Colors.white, fontSize: 12),
            ),
          ),
        ),
        Positioned(
          right: 12, bottom: 44,
          child: PopupMenuButton<double>(
            onSelected: (v) => c.setPlaybackSpeed(v),
            icon: const Icon(Icons.speed, color: Colors.white),
            itemBuilder: (_) => const [
              PopupMenuItem(value: 1.0, child: Text('1x')),
              PopupMenuItem(value: 1.5, child: Text('1.5x')),
              PopupMenuItem(value: 2.0, child: Text('2x')),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _fallback(Color ink) => Padding(
        padding: const EdgeInsets.all(28),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.link_outlined, size: 48, color: Colors.white24),
          const SizedBox(height: 12),
          Text(
            isHls
                ? 'Это HLS-поток (.m3u8) — открой его внешним плеером (VLC / MX Player).'
                : (error ?? 'Не удалось открыть видео.'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () => launchUrl(Uri.parse(widget.url), mode: LaunchMode.externalApplication),
            icon: const Icon(Icons.open_in_new),
            label: const Text('Открыть внешним плеером'),
          ),
        ]),
      );
}
