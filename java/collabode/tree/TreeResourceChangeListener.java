package collabode.tree;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.resources.*;
import org.eclipse.core.runtime.CoreException;

import collabode.Workspace;

public class TreeResourceChangeListener implements IResourceChangeListener {

    public void resourceChanged(IResourceChangeEvent e) {
        IResourceDelta delta = e.getDelta();
        Map<String, List<IResource>> newResources = new HashMap<String, List<IResource>>();
        Map<String, List<IResource>> removedResources = new HashMap<String, List<IResource>>();
        IResourceDeltaVisitor visitor = new TreeResourceDeltaVisitor(newResources, removedResources);

        try {
            delta.accept(visitor);
            for (Map.Entry<String, List<IResource>> entry : newResources.entrySet()) {
                Workspace.scheduleTask("reportNewResource", entry.getValue().toArray(),entry.getKey());
            }
            for (Map.Entry<String, List<IResource>> entry : removedResources.entrySet()) {
                Workspace.scheduleTask("reportRemoveResource", entry.getValue().toArray(), entry.getKey());
            }
        } catch (CoreException e1) {
            // TODO Auto-generated catch block
            e1.printStackTrace();
        }

    }
}
