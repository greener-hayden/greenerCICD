# bash completion for greener-provision
# Usage: source this file or place it in /etc/bash_completion.d/

_greener_provision()
{
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    opts="--help -h --version --repos -r --interactive -i --non-interactive -n \
          --yes -y --worker-url -w --config -c --verbose -v --quiet -q"

    case "$prev" in
        -r|--repos)
            # Expect comma-separated owner/name entries; no dynamic lookup here
            COMPREPLY=()
            return 0
            ;;
        -w|--worker-url|-c|--config)
            COMPREPLY=()
            return 0
            ;;
    esac

    COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
}

complete -F _greener_provision greener-provision

