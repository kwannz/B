{ pkgs }: {
    deps = [
        # Node.js and frontend dependencies
        pkgs.nodejs-18_x
        pkgs.nodePackages.typescript-language-server
        pkgs.yarn
        pkgs.replitPackages.jest
        
        # Python and backend dependencies
        pkgs.python311
        pkgs.python311Packages.pip
        pkgs.python311Packages.virtualenv
        pkgs.python311Packages.numpy
        pkgs.python311Packages.pandas
        pkgs.python311Packages.fastapi
        pkgs.python311Packages.uvicorn
        pkgs.python311Packages.sqlalchemy
        pkgs.python311Packages.psycopg2
        pkgs.python311Packages.python-dotenv
        pkgs.python311Packages.aiohttp
        pkgs.python311Packages.pymongo
        pkgs.python311Packages.python-multipart
        
        # Build tools
        pkgs.gcc
        pkgs.gnumake
    ];
    
    env = {
        PYTHONPATH = "$PYTHONPATH:${pkgs.python311}/lib/python3.11/site-packages";
        PATH = "$PATH:${pkgs.nodejs-18_x}/bin";
    };
}
