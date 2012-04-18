package collabode.tree;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.eclipse.core.resources.*;
import org.eclipse.core.runtime.CoreException;

import collabode.Workspace;

public class TreeResourceDeltaVisitor implements IResourceDeltaVisitor {
    
    private Map<String, List<IResource>> newResources, removedResources;
    public TreeResourceDeltaVisitor(Map<String, List<IResource>> newResources, 
            Map<String, List<IResource>> removedResources) {
        this.newResources = newResources;
        this.removedResources = removedResources;
    }

    private void addToMap(Map<String, List<IResource>> map, String key, IResource resource) {
        if (!map.containsKey(key)) {
            map.put(key, new ArrayList<IResource>());
        }
        map.get(key).add(resource);
    }

    @Override
    public boolean visit(IResourceDelta delta) throws CoreException {
        IResource resourceOld = null, resourceNew = null;

        switch (delta.getKind()) {
            case IResourceDelta.ADDED:
                resourceNew = delta.getResource();
                if (delta.getResource() instanceof IFolder) {
                    TreeManager.getTreeManager().folderAdded(resourceNew.getFullPath().toString(), resourceNew.getParent().getFullPath().toString());
                }

                addToMap(newResources, resourceNew.getParent().getFullPath().toString(), resourceNew);
                return false;
            case IResourceDelta.REMOVED:
                resourceOld = delta.getResource();
                if (delta.getResource() instanceof IFolder) {
                    // For each user: remove folder and all children folders from "open" or "visible"
                    TreeManager.getTreeManager().folderRemoved(resourceOld.getFullPath().toString());
                }

                addToMap(removedResources, resourceOld.getParent().getFullPath().toString(), resourceOld);
                return false;
            case IResourceDelta.CHANGED:
                return true;
        }

        return true;
    }

}
