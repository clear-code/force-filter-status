setlocal
set appname=force-filter-status

copy makexpi\makexpi.sh .\
bash makexpi.sh -n %appname% -o
del makexpi.sh
endlocal
