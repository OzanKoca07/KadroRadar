# Windows PowerShell 5.1 / PowerShell 7. DACL only; never reads/writes SACL.
function Protect-KadroPrivateDirectory {
 param([Parameter(Mandatory=$true)][string]$Path)
 $ErrorActionPreference='Stop'
 if($env:OS -ne 'Windows_NT'){throw 'PRIVATE_DIRECTORY_WINDOWS_REQUIRED'}
 try {
  if(-not ('KadroPrivateDacl' -as [type])){
   Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class KadroPrivateDacl {
 [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
 static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string text, uint revision, out IntPtr descriptor, out uint size);
 [DllImport("advapi32.dll", SetLastError=true)]
 static extern bool GetSecurityDescriptorDacl(IntPtr descriptor, out bool present, out IntPtr dacl, out bool defaulted);
 [DllImport("advapi32.dll", CharSet=CharSet.Unicode)]
 static extern uint SetNamedSecurityInfo(string name, uint type, uint information, IntPtr owner, IntPtr group, IntPtr dacl, IntPtr sacl);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
 public static void Apply(string path, string sddl) {
  IntPtr descriptor=IntPtr.Zero;
  try {
   uint size; if(!ConvertStringSecurityDescriptorToSecurityDescriptor(sddl,1,out descriptor,out size)) throw new InvalidOperationException("DACL_DESCRIPTOR_FAILED");
   bool present,defaulted; IntPtr dacl;
   if(!GetSecurityDescriptorDacl(descriptor,out present,out dacl,out defaulted)||!present||dacl==IntPtr.Zero) throw new InvalidOperationException("DACL_REQUIRED");
   // DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION only.
   if(SetNamedSecurityInfo(path,1,0x80000004,IntPtr.Zero,IntPtr.Zero,dacl,IntPtr.Zero)!=0) throw new InvalidOperationException("DACL_WRITE_FAILED");
  } finally { if(descriptor!=IntPtr.Zero) LocalFree(descriptor); }
 }
}
'@
  }
  $full=[IO.Path]::GetFullPath($Path)
  # Reject links before creation as well as within an existing private tree.
  $ancestor=$full
  while($ancestor){
   if(Test-Path -LiteralPath $ancestor){if((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'REPARSE_POINT_REJECTED'}}
   $parent=[IO.Path]::GetDirectoryName($ancestor);if($parent -eq $ancestor){break};$ancestor=$parent
  }
  New-Item -ItemType Directory -Force -Path $full | Out-Null
  if(-not (Get-Item -LiteralPath $full -Force).PSIsContainer){throw 'DIRECTORY_REQUIRED'}
  $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $allowed=@($sid,'S-1-5-18','S-1-5-32-544')
  # Enumerate one directory at a time; never traverse a junction before checking it.
  $entries=New-Object 'Collections.Generic.List[IO.FileSystemInfo]'
  $pending=New-Object 'Collections.Generic.Queue[IO.DirectoryInfo]'
  $directory=Get-Item -LiteralPath $full -Force;$entries.Add($directory);$pending.Enqueue($directory)
  while($pending.Count){
   foreach($child in @(Get-ChildItem -LiteralPath $pending.Dequeue().FullName -Force)){
    if($child.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'REPARSE_POINT_REJECTED'}
    $entries.Add($child);if($child.PSIsContainer){$pending.Enqueue($child)}
   }
  }
  foreach($entry in $entries){
   if($entry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'REPARSE_POINT_REJECTED'}
   $inherit=if($entry.PSIsContainer){'OICI'}else{''}
   $sddl='D:P'+(($allowed|ForEach-Object {'(A;'+$inherit+';FA;;;'+$_+')'}) -join '')
   [KadroPrivateDacl]::Apply($entry.FullName,$sddl)
   $acl=Get-Acl -LiteralPath $entry.FullName
   if($allowed -notcontains $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value){throw 'UNAUTHORIZED_OWNER'}
   if(-not $acl.AreAccessRulesProtected){throw 'DACL_NOT_PROTECTED'}
   $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
   if($rules.Count -ne 3){throw 'DACL_RULE_COUNT'}
   foreach($rule in $rules){if($allowed -notcontains $rule.IdentityReference.Value -or $rule.IsInherited -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl){throw 'DACL_VERIFICATION_FAILED'}}
  }
  return $full
 } catch {throw 'PRIVATE_DIRECTORY_ACL_FAILED: DACL could not be secured; operation stopped before database access. No SACL privilege is requested.'}
}
