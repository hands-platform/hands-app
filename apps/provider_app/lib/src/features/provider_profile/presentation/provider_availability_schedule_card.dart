import 'package:flutter/material.dart';

import 'provider_error_helpers.dart';

class ProviderAvailabilityScheduleCard extends StatelessWidget {
  const ProviderAvailabilityScheduleCard({
    super.key,
    required this.availability,
    required this.error,
    required this.isLoading,
    required this.isSaving,
    required this.onEdit,
    required this.onRefresh,
  });

  final Map<String, dynamic> availability;
  final Object? error;
  final bool isLoading;
  final bool isSaving;
  final Future<void> Function(Map<String, dynamic>) onEdit;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final hours = _workingHours(availability['workingHours']);
    final reason = availability['availabilityReason']?.toString() ??
        availability['persistedReason']?.toString() ??
        'NOT_RECORDED';
    final intent = availability['availabilityIntent']?.toString() ?? 'OFFLINE';
    final today = availability['todayWindowLabel']?.toString() ??
        (hours.isEmpty ? 'Chưa lưu lịch' : 'Ngày nghỉ');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const CircleAvatar(child: Icon(Icons.schedule_outlined)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Giờ làm việc',
                          style: Theme.of(context).textTheme.titleMedium),
                      Text(isLoading
                          ? 'Đang tải lịch làm việc...'
                          : '${_intentLabel(intent)} / ${_reasonLabel(reason)} / Hôm nay $today'),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: isLoading ? null : onRefresh,
                  tooltip: 'Làm mới giờ làm việc',
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(
                providerAppErrorMessage(
                  error,
                  fallback: 'Không thể tải giờ làm việc.',
                ),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            if (!isLoading && hours.isEmpty) ...[
              const SizedBox(height: 12),
              const Text(
                'Chưa lưu lịch tuần. Hiện trạng thái trực tuyến chỉ được điều khiển bằng công tắc thủ công.',
              ),
            ],
            if (!isLoading && hours.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: hours
                    .map((row) => Chip(
                          label: Text(row.enabled
                              ? '${_weekdayLabel(row.weekday)} ${_minuteLabel(row.startMinute)}-${_minuteLabel(row.endMinute)}'
                              : '${_weekdayLabel(row.weekday)} Nghỉ'),
                        ))
                    .toList(),
              ),
            ],
            const SizedBox(height: 12),
            FilledButton.tonalIcon(
              onPressed:
                  isLoading || isSaving ? null : () => onEdit(availability),
              icon: const Icon(Icons.edit_calendar_outlined),
              label: Text(isSaving ? 'Đang lưu...' : 'Sửa giờ làm việc'),
            ),
          ],
        ),
      ),
    );
  }
}

Future<List<Map<String, dynamic>>?> showProviderWorkingHoursSheet(
  BuildContext context, {
  required Map<String, dynamic> initial,
}) {
  return showModalBottomSheet<List<Map<String, dynamic>>>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _ProviderWorkingHoursSheet(initial: initial),
  );
}

class _ProviderWorkingHoursSheet extends StatefulWidget {
  const _ProviderWorkingHoursSheet({required this.initial});

  final Map<String, dynamic> initial;

  @override
  State<_ProviderWorkingHoursSheet> createState() =>
      _ProviderWorkingHoursSheetState();
}

class _ProviderWorkingHoursSheetState
    extends State<_ProviderWorkingHoursSheet> {
  late final List<_WorkingHourDraft> _rows;

  @override
  void initState() {
    super.initState();
    final saved = {
      for (final row in _workingHours(widget.initial['workingHours']))
        row.weekday: row,
    };
    _rows = List.generate(7, (index) {
      final weekday = index + 1;
      final existing = saved[weekday];
      return _WorkingHourDraft(
        weekday: weekday,
        enabled: existing?.enabled ?? weekday <= 5,
        startMinute: existing?.startMinute ?? 9 * 60,
        endMinute: existing?.endMinute ?? 18 * 60,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Giờ làm việc hằng tuần',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            const Text('Giờ Việt Nam / một khung giờ làm việc mỗi ngày.'),
            const SizedBox(height: 12),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _rows.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final row = _rows[index];
                  return Row(
                    children: [
                      SizedBox(
                        width: 52,
                        child: Text(_weekdayLabel(row.weekday)),
                      ),
                      Switch(
                        value: row.enabled,
                        onChanged: (value) =>
                            setState(() => row.enabled = value),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: row.enabled
                            ? () => _pickTime(row, start: true)
                            : null,
                        child: Text(_minuteLabel(row.startMinute)),
                      ),
                      const Text('-'),
                      TextButton(
                        onPressed: row.enabled
                            ? () => _pickTime(row, start: false)
                            : null,
                        child: Text(_minuteLabel(row.endMinute)),
                      ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _save,
              child: const Text('Lưu giờ làm việc'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickTime(_WorkingHourDraft row, {required bool start}) async {
    final current = start ? row.startMinute : row.endMinute;
    final selected = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: current == 1440 ? 23 : current ~/ 60,
        minute: current == 1440 ? 59 : current % 60,
      ),
    );
    if (selected == null) return;
    final minute = selected.hour * 60 + selected.minute;
    setState(() {
      if (start) {
        row.startMinute = minute;
      } else {
        row.endMinute = minute;
      }
    });
  }

  void _save() {
    final invalid =
        _rows.any((row) => row.enabled && row.startMinute >= row.endMinute);
    if (invalid) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Giờ kết thúc phải sau giờ bắt đầu.')),
      );
      return;
    }
    Navigator.of(context).pop(
      _rows
          .map((row) => {
                'weekday': row.weekday,
                'enabled': row.enabled,
                'startMinute': row.startMinute,
                'endMinute': row.endMinute,
              })
          .toList(),
    );
  }
}

class _WorkingHourDraft {
  _WorkingHourDraft({
    required this.weekday,
    required this.enabled,
    required this.startMinute,
    required this.endMinute,
  });

  final int weekday;
  bool enabled;
  int startMinute;
  int endMinute;
}

List<_WorkingHourDraft> _workingHours(dynamic value) {
  if (value is! List) return [];
  return value
      .whereType<Map>()
      .map((row) {
        return _WorkingHourDraft(
          weekday: (row['weekday'] as num?)?.toInt() ?? 0,
          enabled: row['enabled'] == true,
          startMinute: (row['startMinute'] as num?)?.toInt() ?? 0,
          endMinute: (row['endMinute'] as num?)?.toInt() ?? 0,
        );
      })
      .where((row) => row.weekday >= 1 && row.weekday <= 7)
      .toList()
    ..sort((a, b) => a.weekday.compareTo(b.weekday));
}

String _weekdayLabel(int weekday) => const [
      'Thứ 2',
      'Thứ 3',
      'Thứ 4',
      'Thứ 5',
      'Thứ 6',
      'Thứ 7',
      'Chủ nhật'
    ][weekday - 1];

String _minuteLabel(int value) {
  if (value == 1440) return '24:00';
  final hour = value ~/ 60;
  final minute = value % 60;
  return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
}

String _reasonLabel(String value) {
  switch (value) {
    case 'MANUAL_AVAILABLE':
      return 'Sẵn sàng nhận việc';
    case 'MANUAL_OFFLINE':
      return 'Đã tắt thủ công';
    case 'OUTSIDE_WORKING_HOURS':
      return 'Ngoài giờ làm việc';
    case 'ACTIVE_BOOKING':
      return 'Đang có đặt lịch';
    case 'INACTIVE_7D':
      return 'Không hoạt động hơn 7 ngày';
    default:
      return 'Chưa thiết lập';
  }
}

String _intentLabel(String intent) => switch (intent) {
      'ONLINE' => 'Đang trực tuyến',
      'OFFLINE' => 'Đang ngoại tuyến',
      _ => 'Chưa xác định',
    };
