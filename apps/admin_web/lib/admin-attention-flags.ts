export type AttentionFlag = {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: string;
};

export type AttentionLevel = {
  label: string;
  helper: string;
  tone: 'pill-danger' | 'pill-warn' | 'pill-info' | 'pill-success';
};

export function attentionLevel(flags: AttentionFlag[]): AttentionLevel {
  if (flags.some((flag) => flag.severity === 'high')) {
    return { label: 'Action', helper: `${flags.length} check(s) need attention`, tone: 'pill-danger' };
  }
  if (flags.some((flag) => flag.severity === 'medium')) {
    return { label: 'Monitor', helper: `${flags.length} check(s) to monitor`, tone: 'pill-warn' };
  }
  if (flags.some((flag) => flag.severity === 'low')) {
    return { label: 'Note', helper: `${flags.length} note check(s)`, tone: 'pill-info' };
  }
  return { label: 'Clear', helper: 'No active attention checks', tone: 'pill-success' };
}
