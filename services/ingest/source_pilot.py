"""Optional internal lease budget; absent keeps the established non-pilot parser."""
def budget(state):
    pilot = state.get('pilot')
    if pilot is None:
        return None
    if not isinstance(pilot, dict):
        raise ValueError('PILOT_LIMIT_INVALID')
    limits = pilot.get('limits', {}) if isinstance(pilot, dict) else {}
    if (pilot.get('mode') != 'staging-only' or
        any(type(limits.get(key)) is not int or not 1 <= limits[key] <= maximum
            for key, maximum in [('maxRecords', 25), ('maxDocuments', 2)])):
        raise ValueError('PILOT_LIMIT_INVALID')
    return limits

def bound_report(report, limits):
    if limits is None:
        return report
    if report['sourceId'] == 'career':
        total = len(report['rows'])
        report['rows'] = report['rows'][:limits['maxRecords']]
    else:
        total = sum(len(d['parsed']['candidates']) for d in report['documents'])
        remaining = limits['maxRecords']
        for document in report['documents']:
            candidates = document['parsed']['candidates'][:remaining]
            document['parsed']['candidates'] = candidates
            remaining -= len(candidates)
    report['pilot'] = {'mode': 'staging-only', 'parsedRecords': total,
                       'selectedRecords': min(total, limits['maxRecords']),
                       'truncated': total > limits['maxRecords']}
    report['missingGuids'] = []
    return report
