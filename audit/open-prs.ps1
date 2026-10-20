<#
Pushes the production-fix branch chain and prints a ready-to-open PR link for
each one. Run from the repo root:  .\audit\open-prs.ps1

  -SkipChecks   push without running typecheck / lint / tests first
  -DryRun       show what would be pushed, push nothing

Each branch is based on the one before it, so each PR must target the branch
before it — not Priyanshu — or the diff will include the earlier phases.
Merge them in order: phase1, then phase2, then phase3.

No history is ever rewritten: these are plain fast-forward pushes.
#>
param(
  [switch]$SkipChecks,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repo = "paarth293/Language_metrics"

# head branch -> the branch its PR must target
$chain = [ordered]@{
  "fix/phase1-observability" = "Priyanshu"
  "fix/phase2-payments"      = "fix/phase1-observability"
  "fix/phase3-security"      = "fix/phase2-payments"
}

if (-not $SkipChecks) {
  Write-Host "`n== Checks (all four must pass) ==" -ForegroundColor Cyan
  foreach ($c in @("typecheck", "lint", "test", "test:payments")) {
    Write-Host "-- npm run $c" -ForegroundColor DarkGray
    npm run $c
    if ($LASTEXITCODE -ne 0) { throw "npm run $c failed - not pushing." }
  }
  Write-Host "All four checks passed." -ForegroundColor Green
}

Write-Host "`n== Push ==" -ForegroundColor Cyan
foreach ($branch in $chain.Keys) {
  git show-ref --verify --quiet "refs/heads/$branch"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "skip $branch (no such local branch)" -ForegroundColor Yellow
    continue
  }
  $local  = (git rev-parse $branch).Trim()
  $remote = (git ls-remote origin "refs/heads/$branch" | ForEach-Object { ($_ -split "\s+")[0] })

  if ($remote -eq $local) {
    Write-Host "up to date  $branch ($($local.Substring(0,7)))" -ForegroundColor DarkGray
    continue
  }
  if ($DryRun) {
    Write-Host "would push  $branch -> $($local.Substring(0,7))" -ForegroundColor Yellow
    continue
  }
  # Refuses to overwrite anything that is not a fast-forward.
  git push origin "${branch}:refs/heads/$branch"
  if ($LASTEXITCODE -ne 0) { throw "push of $branch failed." }
  Write-Host "pushed      $branch" -ForegroundColor Green
}

Write-Host "`n== Open these PRs, in this order ==" -ForegroundColor Cyan
foreach ($branch in $chain.Keys) {
  $base = $chain[$branch]
  Write-Host "`n$branch  ->  $base" -ForegroundColor White
  Write-Host "  https://github.com/$repo/compare/$base...${branch}?expand=1"
}

Write-Host "`nIf an 'Open a pull request' page says 'There isn't anything to compare',"
Write-Host "that branch's PR is already open - find it under Pull requests."
Write-Host "With the gh CLI installed you can instead run, per branch:"
Write-Host '  gh pr create --base <base> --head <branch> --fill' -ForegroundColor DarkGray
