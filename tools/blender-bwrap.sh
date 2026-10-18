#!/bin/bash
exec bwrap --ro-bind /var/lib/flatpak/runtime/org.fedoraproject.Platform/x86_64/f44/active/files /usr --symlink usr/lib64 /lib64 --symlink usr/lib /lib --symlink usr/bin /bin --symlink usr/sbin /sbin \
  --ro-bind /var/lib/flatpak/runtime/org.fedoraproject.Platform/x86_64/f44/active/files/etc /etc --ro-bind /var/lib/flatpak/app/org.blender.Blender/x86_64/stable/active/files /app --proc /proc --dev /dev --tmpfs /run \
  --bind /tmp /tmp --bind "$PWD" "$PWD" --chdir "$PWD" \
  --setenv PATH /app/bin:/usr/bin --setenv LD_LIBRARY_PATH /app/lib:/app/lib64:/app/lib64/llvm19/lib \
  /app/bin/blender "$@"
