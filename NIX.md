# melo on Nix

The `flake.nix` exposes three things:

- `packages.melo` (also `packages.default`) — the installable app
- `overlays.default` — an overlay for nixpkgs
- `devShells.default` — a shell for hacking on melo

## Install into your system config (Flakes)

Add the input:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    melo.url = "github:rootscripts/melo";
  };

  outputs = { self, nixpkgs, melo, ... }: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ({ pkgs, ... }: {
          environment.systemPackages = [ melo.packages.x86_64-linux.default ];
        })
      ];
    };
  };
}
```

For home-manager, inside your home config:

```nix
{
  inputs.melo.url = "github:rootscripts/melo";

  outputs = { nixpkgs, home-manager, melo, ... }: {
    homeConfigurations.you = home-manager.lib.homeManagerConfiguration {
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
      modules = [
        ({ pkgs, ... }: {
          home.packages = [ melo.packages.x86_64-linux.default ];
        })
      ];
    };
  };
}
```

## Install via an overlay

Useful when you want `pkgs.melo` available everywhere rather than referencing `melo.packages...` directly:

```nix
{
  inputs.melo.url = "github:rootscripts/melo";

  outputs = { nixpkgs, melo, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ melo.overlays.default ];
      };
    in {
      nixosConfigurations.myhost = pkgs.lib.nixosSystem {
        inherit system;
        modules = [{ environment.systemPackages = [ pkgs.melo ]; }];
      };
    };
}
```

## One-off / user installs (no config change)

```bash
# install into your profile
nix profile install github:rootscripts/melo

# or just run it once
nix run github:rootscripts/melo

# from a local checkout
nix profile install .
nix run .
```

After installing, `melo` is on your `PATH` and a `melo` desktop entry + icon are registered.

## Development shell

```bash
git clone https://github.com/rootscripts/melo
cd melo
nix develop          # nodejs, python3, yt-dlp, ffmpeg
npm install
npm start
```

## Notes

- The package wraps the nixpkgs `electron` with the app directory and puts `yt-dlp` and `ffmpeg` on `PATH`, so melo finds them instead of self-downloading.
- `npmDepsHash` in `flake.nix` must be updated whenever `package.json`/`package-lock.json` change. Rebuild with a wrong/placeholder hash and copy the reported `got:` value, or regenerate it with `nix-prefetch-npm-deps` / `prefetch-npm-deps`.
