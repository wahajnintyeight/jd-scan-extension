import { SiteAdapter } from './types';
import { LinkedInAdapter } from './linkedin';
import { WorkableAdapter } from './workable';
import { IndeedAdapter } from './indeed';
import { GlassdoorAdapter } from './glassdoor';
import { GenericAdapter } from './generic';

const adapters: SiteAdapter[] = [
    new LinkedInAdapter(),
    new WorkableAdapter(),
    new IndeedAdapter(),
    new GlassdoorAdapter(),
    new GenericAdapter() // Must be last as it matches everything
];

export function getAdapter(url: string): SiteAdapter {
    return adapters.find(adapter => adapter.isMatch(url)) || adapters[adapters.length - 1];
}

export * from './types';
export * from './linkedin';
export * from './workable';
export * from './indeed';
export * from './glassdoor';
export * from './generic';
