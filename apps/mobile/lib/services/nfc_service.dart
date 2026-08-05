import 'dart:async';
import 'package:nfc_manager/nfc_manager.dart';

enum NfcWriteStatus { idle, scanning, writing, success, failed, notSupported }

class NfcWriteResult {
  final bool success;
  final String? tagUid;
  final String? tagType;
  final int? capacityBytes;
  final String? verifiedUrl;
  final String? errorMessage;

  const NfcWriteResult({
    required this.success,
    this.tagUid,
    this.tagType,
    this.capacityBytes,
    this.verifiedUrl,
    this.errorMessage,
  });
}

class NfcService {
  static Future<bool> isAvailable() async {
    return NfcManager.instance.isAvailable();
  }

  /// Write [url] to the next detected NDEF-compatible tag.
  /// Reads back the tag immediately after writing to verify.
  static Future<NfcWriteResult> writeUrl(String url) async {
    final completer = Completer<NfcWriteResult>();

    await NfcManager.instance.startSession(
      onDiscovered: (NfcTag tag) async {
        try {
          final ndef = Ndef.from(tag);
          if (ndef == null) {
            await NfcManager.instance.stopSession(errorMessage: 'Tag is not NDEF compatible.');
            completer.complete(const NfcWriteResult(success: false, errorMessage: 'Tag is not NDEF compatible'));
            return;
          }

          if (!ndef.isWritable) {
            await NfcManager.instance.stopSession(errorMessage: 'Tag is read-only.');
            completer.complete(const NfcWriteResult(success: false, errorMessage: 'Tag is read-only'));
            return;
          }

          final record = NdefRecord.createUri(Uri.parse(url));
          final message = NdefMessage([record]);

          // Check capacity before writing
          final encoded = message.byteLength;
          if (encoded > ndef.maxSize) {
            await NfcManager.instance.stopSession(errorMessage: 'URL too large for this tag.');
            completer.complete(const NfcWriteResult(success: false, errorMessage: 'URL too large for tag capacity'));
            return;
          }

          await ndef.write(message);

          // Read back to verify
          final readBack = await ndef.read();
          final writtenUri = _extractUri(readBack);

          final tagId = _extractTagId(tag);
          final tagTypeName = _extractTagType(tag);

          await NfcManager.instance.stopSession();
          completer.complete(NfcWriteResult(
            success: writtenUri == url,
            tagUid: tagId,
            tagType: tagTypeName,
            capacityBytes: ndef.maxSize,
            verifiedUrl: writtenUri,
            errorMessage: writtenUri != url ? 'Verification mismatch' : null,
          ));
        } catch (e) {
          await NfcManager.instance.stopSession(errorMessage: e.toString());
          completer.complete(NfcWriteResult(success: false, errorMessage: e.toString()));
        }
      },
    );

    return completer.future;
  }

  /// Read the current URL from a tag without writing.
  static Future<String?> readUrl() async {
    final completer = Completer<String?>();
    await NfcManager.instance.startSession(
      onDiscovered: (NfcTag tag) async {
        final ndef = Ndef.from(tag);
        if (ndef == null) {
          await NfcManager.instance.stopSession();
          completer.complete(null);
          return;
        }
        final message = await ndef.read();
        await NfcManager.instance.stopSession();
        completer.complete(_extractUri(message));
      },
    );
    return completer.future;
  }

  static String? _extractUri(NdefMessage? message) {
    if (message == null) return null;
    for (final record in message.records) {
      if (record.typeNameFormat == NdefTypeNameFormat.nfcWellknown) {
        try {
          final uriRecord = record;
          // URI record: first byte is prefix code
          if (uriRecord.payload.isNotEmpty) {
            const prefixes = [
              '', 'http://www.', 'https://www.', 'http://', 'https://',
              'tel:', 'mailto:', 'ftp://anonymous:anonymous@', 'ftp://ftp.',
              'ftps://', 'sftp://', 'smb://', 'nfs://', 'ftp://', 'dav://',
              'news:', 'telnet://', 'imap:', 'rtsp://', 'urn:', 'pop:',
              'sip:', 'sips:', 'tftp:', 'btspp://', 'btl2cap://', 'btgoep://',
              'tcpobex://', 'irdaobex://', 'file://', 'urn:epc:id:',
              'urn:epc:tag:', 'urn:epc:pat:', 'urn:epc:raw:', 'urn:epc:',
              'urn:nfc:',
            ];
            final prefixCode = uriRecord.payload.first;
            final prefix = prefixCode < prefixes.length ? prefixes[prefixCode] : '';
            final rest = String.fromCharCodes(uriRecord.payload.sublist(1));
            return '$prefix$rest';
          }
        } catch (_) {}
      }
    }
    return null;
  }

  static String? _extractTagId(NfcTag tag) {
    try {
      final data = tag.data;
      // nfca / nfcb / nfcf / nfcv all expose their identifier differently
      final id = (data['nfca']?['identifier'] ??
              data['nfcb']?['applicationData'] ??
              data['nfcf']?['identifier'] ??
              data['nfcv']?['identifier']) as List<int>?;
      if (id == null) return null;
      return id.map((b) => b.toRadixString(16).padLeft(2, '0')).join(':').toUpperCase();
    } catch (_) {
      return null;
    }
  }

  static String? _extractTagType(NfcTag tag) {
    final data = tag.data;
    if (data.containsKey('nfca')) return 'NFC-A';
    if (data.containsKey('nfcb')) return 'NFC-B';
    if (data.containsKey('nfcf')) return 'NFC-F';
    if (data.containsKey('nfcv')) return 'NFC-V';
    return null;
  }
}
