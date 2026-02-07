
import StatusPanel from '../components/ui/StatusPanel.svelte';
import DeployStream from '../components/ui/DeployStream.svelte';
import FeatureMatrix from '../components/ui/FeatureMatrix.svelte';

// Manual mapping of "LLM String" -> "Svelte Component"
export const COMPONENT_MAP: Record<string, any> = {
    'StatusPanel': StatusPanel,
    'DeployStream': DeployStream,
    'FeatureMatrix': FeatureMatrix
};
