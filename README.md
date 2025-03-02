# @bootc-warehouse/bootc-image-builder-action

GitHub Action for building ISOs and disk images for Bootable Containers.

AWS support is currently untested and may not work as expected.

## Scope

This action is intended to be as close to a 1:1 mapping of the
`bootc-image-builder` tool as possible. It is not interested in providing
additional features or functionality beyond what is provided by the
`bootc-image-builder` tool, and therefore these features should be implemented
in the `bootc-image-builder` tool itself.

## Usage

```yaml
- name: Build ISO
  id: build-iso
  uses: bootc-warehouse/bootc-image-builder-action@vX.Y.Z
  with:
    config-file: ./iso-config.toml
    image: quay.io/fedora/fedora-silverblue:latest
    types: |
      iso

- name: Upload Artifact
  uses: actions/upload-artifact@v4
  with:
    name: iso
    path: ${{ steps.build-iso.outputs.output-directory }}
    if-no-files-found: error
```

## Inputs

### `config-file`

Path to the configuration file.

### `image`

The image to use for building the ISO.

### `builder-image` (optional)

The image to use for building the ISO.

Default: `quay.io/centos-bootc/bootc-image-builder:latest`

### `additional-args` (optional)

Additional arguments to pass to the `bootc-image-builder` tool. This can be used
to enable experimental features or to pass additional arguments to the
`bootc-image-builder` tool.

### `chown` (optional)

The user and group to use for the output directory. In the form of `user:group`.

### `rootfs` (optional)

The root filesystem to use for the ISO.

### `tls-verify` (optional)

Whether to verify TLS certificates.

Default: `true`

### `types` (optional)

The types of artifacts to build. Can be any type supported by
[osbuild/bootc-image-builder](https://github.com/osbuild/bootc-image-builder).

The default will change depending on the image used.

### `aws-ami-name` (optional)

The name of the AMI to create. Only used when `aws` is in `types`.

### `aws-region` (optional)

The region to create the AMI in. Only used when `aws` is in `types`.

### `aws-bucket` (optional)

The name of the S3 bucket to upload the AMI to. Only used when `aws` is in
`types`.

## Outputs

### `output-directory`

The directory containing the built artifacts. Files will be nested in
subdirectories based on the type of artifact.

### `output-paths`

A JSON array of the paths to the built artifacts.

Example (prettified):

```json
[
  {
    "type": "qcow2",
    "path": "/path/to/artifact.qcow2"
  },
  {
    "type": "raw",
    "path": "/path/to/artifact.raw"
  }
]
```

### `manifest-path`

The path to the manifest file used to build the artifacts.

### `qcow2-output-path`

The path to the qcow2 artifact. If the artifact type was not requested, this
will be an empty string.

### `qcow2-output-checksum`

The checksum of the qcow2 artifact. If the artifact type was not requested, this
will be an empty string.

### `vmdk-output-path`

The path to the VMDK artifact. If the artifact type was not requested, this will
be an empty string.

### `vmdk-output-checksum`

The checksum of the VMDK artifact. If the artifact type was not requested, this
will be an empty string.

### `anaconda-iso-output-path`

The path to the Anaconda ISO artifact. If the artifact type was not requested,
this will be an empty string.

### `anaconda-iso-output-checksum`

The checksum of the Anaconda ISO artifact. If the artifact type was not
requested, this will be an empty string.

### `raw-output-path`

The path to the raw artifact. If the artifact type was not requested, this will
be an empty string.

### `raw-output-checksum`

The checksum of the raw artifact. If the artifact type was not requested, this
will be an empty string.

### `vhd-output-path`

The path to the VHD artifact. If the artifact type was not requested, this will
be an empty string.

### `vhd-output-checksum`

The checksum of the VHD artifact. If the artifact type was not requested, this
will be an empty string.

## License

This project is licensed under the Apache License, Version 2.0 - see the
[LICENSE](./LICENSE) file for details.
