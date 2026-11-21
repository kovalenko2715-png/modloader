import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart' show rootBundle;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'models.dart';

class Kernel {
  late String extract, detail, sniff, teach;
  static Future<Kernel> load() async {
    final k = Kernel();
    k.extract = await rootBundle.loadString('assets/js/extract.js');
    k.detail = await rootBundle.loadString('assets/js/detail.js');
    k.sniff = await rootBundle.loadString('assets/js/sniff.js');
    k.teach = await rootBundle.loadString('assets/js/teach.js');
    return k;
  }

  static Future<dynamic> runScript(
      WebViewController ctl, String src, Map<String, dynamic> params) async {
    final js =
        '(function(){var __P=${jsonEncode(params)};return (${src})(__P);})()';
    try {
      final r = await ctl.runJavaScriptReturningResult(js);
      var s = r == null ? '' : r.toString();
      if (s.isEmpty || s == 'null') return null;
      try {
        return jsonDecode(s);
      } catch (_) {
        return s;
      }
    } catch (e) {
      return null;
    }
  }
}

class Store {
  static late Store I;
  final SharedPreferences sp;
  Store(this.sp);

  static Future<void> init() async {
    I = Store(await SharedPreferences.getInstance());
  }

  static const _kSites = 'sites_v1';
  static const _kHist = 'hist_v1';
  static const _kInco = 'incognito';
  static const _kAmoled = 'amoled';

  List<Site> sites() {
    final raw = sp.getStringList(_kSites) ?? const [];
    return raw.map((s) => Site.fromJson(jsonDecode(s))).toList();
  }

  void saveSites(List<Site> list) =>
      sp.setStringList(_kSites, list.map((s) => jsonEncode(s.toJson())).toList());

  List<HistEntry> history() {
    final raw = sp.getStringList(_kHist) ?? const [];
    final out = <HistEntry>[];
    for (final s in raw) {
      try {
        out.add(HistEntry.fromJson(jsonDecode(s)));
      } catch (_) {}
    }
    return out;
  }

  void pushHistory(HistEntry e) {
    if (incognito) return;
    final h = history()..removeWhere((x) => x.link == e.link);
    h.insert(0, e);
    while (h.length > 100) h.removeLast();
    sp.setStringList(_kHist, h.map((x) => jsonEncode(x.toJson())).toList());
  }

  void clearHistory() => sp.remove(_kHist);

  bool get incognito => sp.getBool(_kInco) ?? false;
  set incognito(bool v) => sp.setBool(_kInco, v);
  bool get amoled => sp.getBool(_kAmoled) ?? true;
  set amoled(bool v) => sp.setBool(_kAmoled, v);

  Future<void> exportTo(String path) async {
    final data = {
      'sites': sites().map((s) => s.toJson()).toList(),
      'history': history().map((h) => h.toJson()).toList(),
    };
    await File(path).writeAsString(jsonEncode(data));
  }
}
